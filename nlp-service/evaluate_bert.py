"""Measure the fine-tuned BERT classifier on the same test split used for training.

IMPORTANT: the split below must stay identical to train_bert.py
(test_size=0.2, random_state=42, stratify on the encoded label).
Changing the seed would put training resumes into the test set and
produce a falsely high score.

Run:  ./venv/bin/python evaluate_bert.py
"""

import os
import pickle
import sys
import time

import numpy as np
import pandas as pd
import torch
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    f1_score,
    precision_recall_fscore_support,
)
from sklearn.model_selection import train_test_split
from transformers import BertForSequenceClassification, BertTokenizer

DATA_PATH = "data/ResumeAtlas.csv"
MODEL_DIR = "./bert_resume_model"
ENCODER_PATH = "bert_label_encoder.pkl"
REPORT_PATH = "BERT_REPORT.md"
MAX_LENGTH = 256          # same as train_bert.py
BATCH_SIZE = 32

# ─── Preflight checks ─────────────────────────────────
for path, hint in [
    (DATA_PATH, "run: ./venv/bin/python download_dataset.py"),
    (MODEL_DIR, "the trained model folder is missing"),
    (ENCODER_PATH, "the label encoder is missing"),
]:
    if not os.path.exists(path):
        sys.exit(f"ERROR: '{path}' not found — {hint}")

# ─── Device ───────────────────────────────────────────
if torch.cuda.is_available():
    device = "cuda"
elif torch.backends.mps.is_available():
    device = "mps"
else:
    device = "cpu"
print(f"Device: {device}")

# ─── Load data and rebuild the exact same split ───────
print("\nLoading dataset...")
df = pd.read_csv(DATA_PATH)
df = df.dropna(subset=["Text", "Category"])
print(f"Total resumes: {len(df)}")
print(f"Categories:    {df['Category'].nunique()}")

with open(ENCODER_PATH, "rb") as f:
    le = pickle.load(f)

# transform (not fit) so labels match the ids the model was trained with
df["label"] = le.transform(df["Category"])

_, test_df = train_test_split(
    df, test_size=0.2, random_state=42, stratify=df["label"]
)
print(f"Test samples:  {len(test_df)}")

# ─── Load the fine-tuned model ────────────────────────
print("\nLoading fine-tuned BERT...")
tokenizer = BertTokenizer.from_pretrained(MODEL_DIR)
model = BertForSequenceClassification.from_pretrained(MODEL_DIR)
model.to(device)
model.eval()

# ─── Predict in batches ───────────────────────────────
texts = test_df["Text"].astype(str).tolist()
y_true = test_df["label"].to_numpy()
y_pred = []

print("\nPredicting...")
start = time.time()
for i in range(0, len(texts), BATCH_SIZE):
    batch = texts[i : i + BATCH_SIZE]
    encoded = tokenizer(
        batch,
        truncation=True,
        padding="max_length",
        max_length=MAX_LENGTH,
        return_tensors="pt",
    )
    input_ids = encoded["input_ids"].to(device)
    attention_mask = encoded["attention_mask"].to(device)

    with torch.no_grad():
        outputs = model(input_ids=input_ids, attention_mask=attention_mask)

    y_pred.extend(outputs.logits.argmax(dim=1).cpu().numpy().tolist())

    done = min(i + BATCH_SIZE, len(texts))
    print(f"  {done}/{len(texts)}", end="\r", flush=True)

elapsed = time.time() - start
y_pred = np.array(y_pred)

# ─── Metrics ──────────────────────────────────────────
accuracy = accuracy_score(y_true, y_pred)
macro_f1 = f1_score(y_true, y_pred, average="macro")
weighted_f1 = f1_score(y_true, y_pred, average="weighted")
per_resume_ms = (elapsed / len(texts)) * 1000

print("\n\n" + "=" * 55)
print(f"Accuracy     : {accuracy * 100:.2f}%")
print(f"Macro F1     : {macro_f1:.4f}")
print(f"Weighted F1  : {weighted_f1:.4f}")
print(f"Speed        : {per_resume_ms:.1f} ms per resume ({device})")
print("=" * 55)
print("\nClassification report:\n")
print(classification_report(y_true, y_pred, target_names=le.classes_, zero_division=0))

# ─── Per-category table, worst first ──────────────────
labels_present = np.arange(len(le.classes_))
precision, recall, f1, support = precision_recall_fscore_support(
    y_true, y_pred, labels=labels_present, zero_division=0
)

rows = sorted(
    zip(le.classes_, precision, recall, f1, support),
    key=lambda r: r[3],
)

# ─── Write the report ─────────────────────────────────
lines = [
    "# Fine-tuned BERT — Performance Report",
    "",
    "## Setup",
    "",
    "| Item | Value |",
    "|------|-------|",
    "| Model | `bert-base-uncased`, fine-tuned |",
    f"| Dataset | `{DATA_PATH}` |",
    f"| Total resumes | {len(df)} |",
    f"| Categories | {len(le.classes_)} |",
    "| Train/test split | 80/20, `random_state=42`, stratified |",
    f"| Test samples | {len(test_df)} |",
    f"| Max sequence length | {MAX_LENGTH} tokens |",
    "| Epochs | 3 |",
    f"| Device | {device} |",
    "",
    "## Overall Performance",
    "",
    "| Metric | Score |",
    "|--------|-------|",
    f"| Accuracy | {accuracy * 100:.2f}% |",
    f"| Macro F1 | {macro_f1:.4f} |",
    f"| Weighted F1 | {weighted_f1:.4f} |",
    f"| Inference speed | {per_resume_ms:.1f} ms per resume |",
    "",
    "## Per Category Performance (worst first)",
    "",
    "The category decides which job vacancies a candidate is shown, so a low",
    "recall here means those candidates see very few relevant jobs.",
    "",
    "| Category | Precision | Recall | F1 | Support |",
    "|----------|-----------|--------|----|---------|",
]

for name, p, r, f, s in rows:
    lines.append(f"| {name} | {p:.2f} | {r:.2f} | {f:.2f} | {int(s)} |")

lines += [
    "",
    "## Note on methodology",
    "",
    "`train_bert.py` uses this same test set as its evaluation set with",
    "`load_best_model_at_end=True`, so the best checkpoint was selected using",
    "these resumes. The score above is therefore slightly optimistic. A separate",
    "validation split would remove this effect.",
    "",
]

with open(REPORT_PATH, "w") as f:
    f.write("\n".join(lines))

print(f"\nReport written to {REPORT_PATH}")
