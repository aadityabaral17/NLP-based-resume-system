"""TF-IDF + LinearSVC baseline, measured on the SAME data and split as BERT.

Why this file exists
--------------------
train_model.py trains on data/Resume.csv (24 categories) while train_bert.py
trains on data/ResumeAtlas.csv (43 categories), so their scores were never
comparable. This script re-runs the classical approach on ResumeAtlas with the
identical split, so SVM and BERT can be put in one table.

Two corrections to the original train_model.py:
  1. The TF-IDF vectorizer is fitted on the TRAINING SET ONLY. The original
     called fit_transform() on the whole dataframe before splitting, which let
     test documents influence the vocabulary and IDF weights (data leakage).
  2. Labels come from bert_label_encoder.pkl instead of a fresh LabelEncoder,
     so both models use exactly the same category ids.

Cleaned text is cached, so the second run is fast.

Run:  ./venv/bin/python evaluate_svm_baseline.py
"""

import os
import pickle
import sys
import time

import pandas as pd
import spacy
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    f1_score,
    precision_recall_fscore_support,
)
from sklearn.model_selection import train_test_split
from sklearn.svm import LinearSVC

DATA_PATH = "data/ResumeAtlas.csv"
CACHE_PATH = "data/ResumeAtlas_cleaned.csv"
ENCODER_PATH = "bert_label_encoder.pkl"
REPORT_PATH = "SVM_BASELINE_REPORT.md"

for path in (DATA_PATH, ENCODER_PATH):
    if not os.path.exists(path):
        sys.exit(f"ERROR: '{path}' not found")

# ─── Load data ────────────────────────────────────────
print("Loading dataset...")
df = pd.read_csv(DATA_PATH)
df = df.dropna(subset=["Text", "Category"])
print(f"Total resumes: {len(df)}")

with open(ENCODER_PATH, "rb") as f:
    le = pickle.load(f)

df["label"] = le.transform(df["Category"])

# ─── Clean text (same rules as train_model.py) ────────
if os.path.exists(CACHE_PATH):
    print(f"Using cached cleaned text from {CACHE_PATH}")
    cached = pd.read_csv(CACHE_PATH)
    df["cleaned_text"] = cached["cleaned_text"].fillna("").tolist()
else:
    print("Loading spaCy...")
    nlp = spacy.load("en_core_web_sm", disable=["parser", "ner"])

    import re

    def prepare(text):
        if not isinstance(text, str):
            return ""
        text = re.sub(r"http\S+|www\S+", "", text)
        text = re.sub(r"\S+@\S+", "", text)
        text = re.sub(r"[^a-zA-Z\s]", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        return text.lower()

    raw = [prepare(t) for t in df["Text"]]

    print(f"Lemmatising {len(raw)} resumes (this takes a few minutes)...")
    cleaned = []
    start = time.time()
    for i, doc in enumerate(nlp.pipe(raw, batch_size=64), start=1):
        cleaned.append(
            " ".join(
                token.lemma_
                for token in doc
                if not token.is_stop
                and not token.is_punct
                and not token.is_space
                and len(token.text) > 2
            )
        )
        if i % 250 == 0 or i == len(raw):
            print(f"  {i}/{len(raw)}  ({time.time() - start:.0f}s)", end="\r", flush=True)

    df["cleaned_text"] = cleaned
    pd.DataFrame({"cleaned_text": cleaned}).to_csv(CACHE_PATH, index=False)
    print(f"\nCached cleaned text to {CACHE_PATH}")

# ─── Same split as BERT ───────────────────────────────
train_df, test_df = train_test_split(
    df, test_size=0.2, random_state=42, stratify=df["label"]
)
print(f"\nTrain samples: {len(train_df)}")
print(f"Test samples:  {len(test_df)}")

# ─── TF-IDF fitted on TRAIN ONLY (no leakage) ─────────
print("\nVectorising (fit on train only)...")
vectorizer = TfidfVectorizer(
    max_features=15000,
    ngram_range=(1, 3),
    sublinear_tf=True,
    min_df=2,
    analyzer="word",
    strip_accents="unicode",
)
X_train = vectorizer.fit_transform(train_df["cleaned_text"])
X_test = vectorizer.transform(test_df["cleaned_text"])
y_train = train_df["label"]
y_test = test_df["label"]
print(f"Feature matrix: {X_train.shape}")

# ─── Train ────────────────────────────────────────────
print("\nTraining LinearSVC...")
start = time.time()
svm = LinearSVC(C=2.0, max_iter=3000, random_state=42, class_weight="balanced")
svm.fit(X_train, y_train)
train_time = time.time() - start
print(f"Trained in {train_time:.1f}s")

# ─── Evaluate ─────────────────────────────────────────
start = time.time()
y_pred = svm.predict(X_test)
predict_ms = ((time.time() - start) / len(test_df)) * 1000

accuracy = accuracy_score(y_test, y_pred)
macro_f1 = f1_score(y_test, y_pred, average="macro")
weighted_f1 = f1_score(y_test, y_pred, average="weighted")

print("\n" + "=" * 55)
print(f"Accuracy     : {accuracy * 100:.2f}%")
print(f"Macro F1     : {macro_f1:.4f}")
print(f"Weighted F1  : {weighted_f1:.4f}")
print(f"Speed        : {predict_ms:.2f} ms per resume (CPU)")
print("=" * 55)
print("\nClassification report:\n")
print(classification_report(y_test, y_pred, target_names=le.classes_, zero_division=0))

# ─── Report ───────────────────────────────────────────
precision, recall, f1, support = precision_recall_fscore_support(
    y_test, y_pred, labels=range(len(le.classes_)), zero_division=0
)
rows = sorted(zip(le.classes_, precision, recall, f1, support), key=lambda r: r[3])

lines = [
    "# TF-IDF + LinearSVC — Baseline Report",
    "",
    "Measured on the same dataset and the same train/test split as the",
    "fine-tuned BERT model, so the two can be compared directly.",
    "",
    "## Setup",
    "",
    "| Item | Value |",
    "|------|-------|",
    "| Vectoriser | TF-IDF, 15000 features, 1-3 grams, min_df=2 |",
    "| Classifier | LinearSVC (C=2.0, class_weight=balanced) |",
    "| Preprocessing | lowercase, strip URLs/emails, stop-word removal, spaCy lemmatisation |",
    f"| Dataset | `{DATA_PATH}` |",
    f"| Total resumes | {len(df)} |",
    f"| Categories | {len(le.classes_)} |",
    "| Train/test split | 80/20, `random_state=42`, stratified |",
    f"| Test samples | {len(test_df)} |",
    "",
    "## Overall Performance",
    "",
    "| Metric | Score |",
    "|--------|-------|",
    f"| Accuracy | {accuracy * 100:.2f}% |",
    f"| Macro F1 | {macro_f1:.4f} |",
    f"| Weighted F1 | {weighted_f1:.4f} |",
    f"| Training time | {train_time:.1f} s |",
    f"| Inference speed | {predict_ms:.2f} ms per resume |",
    "",
    "## Per Category Performance (worst first)",
    "",
    "| Category | Precision | Recall | F1 | Support |",
    "|----------|-----------|--------|----|---------|",
]
for name, p, r, f, s in rows:
    lines.append(f"| {name} | {p:.2f} | {r:.2f} | {f:.2f} | {int(s)} |")

lines += [
    "",
    "## Differences from the original `train_model.py`",
    "",
    "1. **Dataset.** The original used `data/Resume.csv` (24 categories) and",
    "   reported 63.38% accuracy. That number is not comparable to BERT, which",
    "   was trained on ResumeAtlas with 43 categories. This run uses ResumeAtlas.",
    "2. **No data leakage.** The original called `fit_transform()` on the whole",
    "   dataset before splitting, so test documents shaped the TF-IDF vocabulary",
    "   and IDF weights. Here the vectoriser is fitted on the training set only,",
    "   which is the correct procedure and gives an honest test score.",
    "",
]

with open(REPORT_PATH, "w") as f:
    f.write("\n".join(lines))

print(f"\nReport written to {REPORT_PATH}")
