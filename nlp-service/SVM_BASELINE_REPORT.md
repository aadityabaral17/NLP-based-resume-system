# TF-IDF + LinearSVC — Baseline Report

Measured on the same dataset and the same train/test split as the
fine-tuned BERT model, so the two can be compared directly.

## Setup

| Item | Value |
|------|-------|
| Vectoriser | TF-IDF, 15000 features, 1-3 grams, min_df=2 |
| Classifier | LinearSVC (C=2.0, class_weight=balanced) |
| Preprocessing | lowercase, strip URLs/emails, stop-word removal, spaCy lemmatisation |
| Dataset | `data/ResumeAtlas.csv` |
| Total resumes | 13389 |
| Categories | 43 |
| Train/test split | 80/20, `random_state=42`, stratified |
| Test samples | 2678 |

## Overall Performance

| Metric | Score |
|--------|-------|
| Accuracy | 83.72% |
| Macro F1 | 0.8258 |
| Weighted F1 | 0.8333 |
| Training time | 4.4 s |
| Inference speed | 0.00 ms per resume |

## Per Category Performance (worst first)

| Category | Precision | Recall | F1 | Support |
|----------|-----------|--------|----|---------|
| React Developer | 0.44 | 0.42 | 0.43 | 36 |
| Management | 0.63 | 0.36 | 0.46 | 72 |
| BPO | 0.77 | 0.60 | 0.68 | 40 |
| Automobile | 0.71 | 0.65 | 0.68 | 63 |
| Database | 0.74 | 0.63 | 0.68 | 51 |
| Sales | 0.67 | 0.71 | 0.69 | 73 |
| Python Developer | 0.71 | 0.71 | 0.71 | 49 |
| Finance | 0.79 | 0.71 | 0.74 | 68 |
| SQL Developer | 0.75 | 0.78 | 0.76 | 68 |
| Consultant | 0.82 | 0.74 | 0.78 | 74 |
| ETL Developer | 0.81 | 0.78 | 0.79 | 59 |
| Blockchain | 1.00 | 0.67 | 0.80 | 9 |
| Data Science | 0.77 | 0.83 | 0.80 | 60 |
| Architecture | 0.84 | 0.77 | 0.80 | 69 |
| Web Designing | 0.85 | 0.76 | 0.80 | 62 |
| Designing | 0.79 | 0.82 | 0.81 | 51 |
| Digital Media | 0.86 | 0.78 | 0.82 | 72 |
| Information Technology | 0.85 | 0.80 | 0.82 | 55 |
| Advocate | 0.80 | 0.84 | 0.82 | 58 |
| Operations Manager | 0.85 | 0.83 | 0.84 | 69 |
| Food and Beverages | 0.87 | 0.81 | 0.84 | 32 |
| Testing | 0.79 | 0.93 | 0.85 | 69 |
| Business Analyst | 0.85 | 0.88 | 0.86 | 68 |
| Apparel | 0.83 | 0.91 | 0.87 | 64 |
| DotNet Developer | 0.85 | 0.88 | 0.87 | 66 |
| Human Resources | 0.80 | 0.94 | 0.87 | 72 |
| Education | 0.86 | 0.91 | 0.89 | 82 |
| PMO | 0.85 | 0.93 | 0.89 | 57 |
| Accountant | 0.85 | 0.94 | 0.89 | 70 |
| Banking | 0.87 | 0.94 | 0.90 | 63 |
| Civil Engineer | 0.89 | 0.92 | 0.91 | 73 |
| Electrical Engineering | 0.87 | 0.95 | 0.91 | 77 |
| Network Security Engineer | 0.92 | 0.89 | 0.91 | 66 |
| Building and Construction | 0.89 | 0.93 | 0.91 | 69 |
| Java Developer | 0.89 | 0.94 | 0.92 | 70 |
| Health and Fitness | 0.91 | 0.92 | 0.92 | 66 |
| Public Relations | 0.92 | 0.91 | 0.92 | 67 |
| Arts | 0.97 | 0.88 | 0.92 | 66 |
| SAP Developer | 0.92 | 0.93 | 0.93 | 61 |
| Aviation | 0.88 | 1.00 | 0.94 | 68 |
| Mechanical Engineer | 0.95 | 0.96 | 0.95 | 77 |
| Agriculture | 0.92 | 1.00 | 0.96 | 59 |
| DevOps | 0.98 | 0.98 | 0.98 | 58 |

## Differences from the original `train_model.py`

1. **Dataset.** The original used `data/Resume.csv` (24 categories) and
   reported 63.38% accuracy. That number is not comparable to BERT, which
   was trained on ResumeAtlas with 43 categories. This run uses ResumeAtlas.
2. **No data leakage.** The original called `fit_transform()` on the whole
   dataset before splitting, so test documents shaped the TF-IDF vocabulary
   and IDF weights. Here the vectoriser is fitted on the training set only,
   which is the correct procedure and gives an honest test score.
