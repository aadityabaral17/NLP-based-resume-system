"""Three-way comparison: TF-IDF+SVM vs fine-tuned BERT vs zero-shot Qwen3 4B.

All three are measured on the SAME resumes, drawn from the same held-out test
split used by train_bert.py (test_size=0.2, random_state=42).

Why a sample rather than the full test set: the LLM needs roughly two seconds
per resume, so all 2678 would take about ninety minutes. A stratified sample
(the same number of resumes from every category) keeps every class represented
and finishes in a few minutes. SVM and BERT are also scored on exactly this
sample, so the three numbers are directly comparable — they are NOT compared
against the full-test-set figures in the other reports.

Run:  ./venv/bin/python evaluate_llm_classification.py [per_category]
"""

import os
import pickle
import sys
import time

import numpy as np
import pandas as pd
import torch
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split
from sklearn.svm import LinearSVC
from transformers import BertForSequenceClassification, BertTokenizer

import llm_client

DATA_PATH = "data/ResumeAtlas.csv"
CACHE_PATH = "data/ResumeAtlas_cleaned.csv"
MODEL_DIR = "./bert_resume_model"
ENCODER_PATH = "bert_label_encoder.pkl"
REPORT_PATH = "MODEL_COMPARISON_REPORT.md"
MAX_LENGTH = 256
LLM_MAX_CHARS = 3000

PER_CATEGORY = int(sys.argv[1]) if len(sys.argv) > 1 else 5


def main():
    for path in (DATA_PATH, ENCODER_PATH, MODEL_DIR):
        if not os.path.exists(path):
            sys.exit(f"ERROR: '{path}' not found")

    if not llm_client.is_available():
        sys.exit(f"ERROR: no LLM at {llm_client.BASE_URL} — start LM Studio first.")

    print(f"LLM model: {llm_client.MODEL}\n")

    # ─── Same split as training ───────────────────────
    # reset_index so row positions line up with the cached cleaned-text file,
    # which was written in this same order by evaluate_svm_baseline.py
    df = (
        pd.read_csv(DATA_PATH)
        .dropna(subset=["Text", "Category"])
        .reset_index(drop=True)
    )
    with open(ENCODER_PATH, "rb") as f:
        le = pickle.load(f)
    df["label"] = le.transform(df["Category"])

    train_df, test_df = train_test_split(
        df, test_size=0.2, random_state=42, stratify=df["label"]
    )

    # Stratified sample of the test set, so every category is represented.
    # Built with an explicit loop rather than groupby().apply(), which drops the
    # grouping column in pandas 3. The original index is preserved so the
    # cleaned-text cache can be looked up by row position.
    sample = pd.concat(
        [
            group.sample(n=min(PER_CATEGORY, len(group)), random_state=42)
            for _, group in test_df.groupby("label")
        ]
    )
    print(f"Test set: {len(test_df)} resumes")
    print(f"Sample:   {len(sample)} resumes ({PER_CATEGORY} per category)\n")

    y_true = sample["label"].to_numpy()
    categories = list(le.classes_)
    results = {}

    # ─── 1. TF-IDF + LinearSVC ────────────────────────
    print("[1/3] TF-IDF + LinearSVC...")
    if not os.path.exists(CACHE_PATH):
        sys.exit(
            f"ERROR: '{CACHE_PATH}' not found — run evaluate_svm_baseline.py first "
            "to build the cleaned-text cache."
        )
    cleaned = pd.read_csv(CACHE_PATH)["cleaned_text"].fillna("").tolist()
    if len(cleaned) != len(df):
        sys.exit(
            f"ERROR: '{CACHE_PATH}' has {len(cleaned)} rows but the dataset has "
            f"{len(df)}. Delete the cache and re-run evaluate_svm_baseline.py."
        )

    train_clean = [cleaned[i] for i in train_df.index]
    sample_clean = [cleaned[i] for i in sample.index]

    vectorizer = TfidfVectorizer(
        max_features=15000, ngram_range=(1, 3), sublinear_tf=True,
        min_df=2, analyzer="word", strip_accents="unicode",
    )
    X_train = vectorizer.fit_transform(train_clean)
    svm = LinearSVC(C=2.0, max_iter=3000, random_state=42, class_weight="balanced")
    svm.fit(X_train, train_df["label"])

    start = time.time()
    svm_pred = svm.predict(vectorizer.transform(sample_clean))
    results["TF-IDF + LinearSVC"] = {
        "pred": svm_pred,
        "ms": (time.time() - start) / len(sample) * 1000,
        "invalid": 0,
    }

    # ─── 2. Fine-tuned BERT ───────────────────────────
    print("[2/3] Fine-tuned BERT...")
    device = (
        "cuda" if torch.cuda.is_available()
        else "mps" if torch.backends.mps.is_available()
        else "cpu"
    )
    tokenizer = BertTokenizer.from_pretrained(MODEL_DIR)
    model = BertForSequenceClassification.from_pretrained(MODEL_DIR).to(device)
    model.eval()

    texts = sample["Text"].astype(str).tolist()
    bert_pred = []
    start = time.time()
    for i in range(0, len(texts), 32):
        enc = tokenizer(
            texts[i : i + 32], truncation=True, padding="max_length",
            max_length=MAX_LENGTH, return_tensors="pt",
        )
        with torch.no_grad():
            out = model(
                input_ids=enc["input_ids"].to(device),
                attention_mask=enc["attention_mask"].to(device),
            )
        bert_pred.extend(out.logits.argmax(dim=1).cpu().numpy().tolist())
    results["Fine-tuned BERT"] = {
        "pred": np.array(bert_pred),
        "ms": (time.time() - start) / len(sample) * 1000,
        "invalid": 0,
    }

    # ─── 3. Zero-shot LLM ─────────────────────────────
    print(f"[3/3] Zero-shot {llm_client.MODEL}...")
    category_list = "\n".join(categories)
    system = (
        "You classify resumes into exactly one job category.\n"
        "Output ONLY a JSON object like {\"category\": \"Java Developer\"}.\n"
        "No markdown, no explanation.\n"
        "The category MUST be copied exactly from this list:\n"
        f"{category_list}"
    )

    lookup = {c.lower(): idx for idx, c in enumerate(categories)}
    llm_pred, invalid = [], 0
    invalid_examples = []  # (true category, what the model answered)
    true_names = sample["Category"].tolist()
    start = time.time()

    for i, text in enumerate(texts, start=1):
        reply = llm_client.chat_json(
            system=system,
            user=f"Resume:\n{text[:LLM_MAX_CHARS]}",
            max_tokens=30,
            temperature=0.0,
        )
        answer = ""
        if isinstance(reply, dict):
            answer = str(reply.get("category", "")).strip()
        elif isinstance(reply, list) and reply:
            answer = str(reply[0]).strip()

        idx = lookup.get(answer.lower())
        if idx is None:
            # accept a close match before giving up (e.g. "Java developer")
            for name, name_idx in lookup.items():
                if name in answer.lower() or answer.lower() in name:
                    idx = name_idx
                    break
        if idx is None:
            invalid += 1
            invalid_examples.append((true_names[i - 1], answer or "(no answer)"))
            idx = -1  # counts as wrong
        llm_pred.append(idx)

        if i % 20 == 0 or i == len(texts):
            print(f"  {i}/{len(texts)}", end="\r", flush=True)

    results[f"Zero-shot {llm_client.MODEL}"] = {
        "pred": np.array(llm_pred),
        "ms": (time.time() - start) / len(sample) * 1000,
        "invalid": invalid,
    }
    print()

    # ─── Report ───────────────────────────────────────
    rows = []
    for name, data in results.items():
        rows.append({
            "name": name,
            "accuracy": accuracy_score(y_true, data["pred"]),
            "macro_f1": f1_score(y_true, data["pred"], average="macro", zero_division=0),
            "ms": data["ms"],
            "invalid": data["invalid"],
        })

    print("\n" + "=" * 74)
    print(f"{'Model':<34}{'Accuracy':>10}{'Macro F1':>11}{'ms/resume':>13}")
    print("-" * 74)
    for r in rows:
        print(f"{r['name']:<34}{r['accuracy']*100:>9.2f}%{r['macro_f1']:>11.4f}{r['ms']:>13.1f}")
    print("=" * 74)

    fastest = min(r["ms"] for r in rows)
    lines = [
        "# Model Comparison — SVM vs BERT vs LLM",
        "",
        "All three models classify the **same** resumes: a stratified sample of the",
        "held-out test split (`test_size=0.2, random_state=42`), with",
        f"{PER_CATEGORY} resumes from each of the {len(categories)} categories.",
        "",
        "The LLM needs roughly two seconds per resume, so scoring the full 2678-resume",
        "test set would take about ninety minutes. The sample keeps every category",
        "represented while staying practical to run. Because the sample is smaller than",
        "the full test set, these accuracies differ slightly from those in",
        "`BERT_REPORT.md` and `SVM_BASELINE_REPORT.md` — compare the numbers in this",
        "table with each other, not across reports.",
        "",
        "## Results",
        "",
        f"Sample size: **{len(sample)} resumes**, {len(categories)} categories.",
        "",
        "| Model | Accuracy | Macro F1 | ms / resume | Relative speed |",
        "|-------|----------|----------|-------------|----------------|",
    ]
    for r in rows:
        lines.append(
            f"| {r['name']} | {r['accuracy']*100:.2f}% | {r['macro_f1']:.4f} | "
            f"{r['ms']:.1f} | {r['ms']/fastest:.0f}x |"
        )

    llm_row = rows[-1]

    if invalid_examples:
        pct = llm_row["invalid"] / len(sample) * 100
        lines += [
            "",
            "## Where the LLM fails: it invents categories",
            "",
            f"On **{llm_row['invalid']} of {len(sample)}** resumes ({pct:.1f}%) the model",
            "answered with a job title that is **not one of the 43 allowed categories**,",
            "despite the prompt listing them and instructing it to copy one exactly.",
            "These are counted as wrong.",
            "",
            "| True category | What the model answered |",
            "|---------------|-------------------------|",
        ]
        for true_name, answer in invalid_examples[:15]:
            lines.append(f"| {true_name} | `{answer}` |")
        lines += [
            "",
            "Most of these are *reasonable descriptions of the resume* — 'Graphic Designer'",
            "for a Digital Media CV, 'Retail' for an Apparel one. The model understands the",
            "document; it will not stay inside the taxonomy. A trained classifier cannot make",
            "this mistake, because its output layer only has the 43 valid classes.",
            "",
            "This is the practical argument for keeping BERT: correctness here is a property",
            "of the model architecture, not of prompt wording.",
        ]

    lines += [
        "",
        "## Notes",
        "",
        f"- The LLM returned a category outside the allowed list **{llm_row['invalid']}** "
        f"time(s) out of {len(sample)}; those count as wrong answers.",
        "- The LLM is *zero-shot*: it has never seen this training data. BERT and SVM",
        "  were both trained on 10,711 resumes from the same distribution, so this is",
        "  not a like-for-like contest — it measures whether a general model can",
        "  substitute for a task-specific trained one.",
        "- Temperature is 0.0 for the LLM, so its answers are as deterministic as the",
        "  runtime allows.",
        "",
    ]

    with open(REPORT_PATH, "w") as f:
        f.write("\n".join(lines))
    print(f"\nReport written to {REPORT_PATH}")


if __name__ == "__main__":
    main()
