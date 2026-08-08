# Fine-tuned BERT — Performance Report

## Setup

| Item | Value |
|------|-------|
| Model | `bert-base-uncased`, fine-tuned |
| Dataset | `data/ResumeAtlas.csv` |
| Total resumes | 13389 |
| Categories | 43 |
| Train/test split | 80/20, `random_state=42`, stratified |
| Test samples | 2678 |
| Max sequence length | 256 tokens |
| Epochs | 3 |
| Device | mps |

## Overall Performance

| Metric | Score |
|--------|-------|
| Accuracy | 88.39% |
| Macro F1 | 0.8748 |
| Weighted F1 | 0.8828 |
| Inference speed | 14.8 ms per resume |

## Per Category Performance (worst first)

The category decides which job vacancies a candidate is shown, so a low
recall here means those candidates see very few relevant jobs.

| Category | Precision | Recall | F1 | Support |
|----------|-----------|--------|----|---------|
| React Developer | 0.51 | 0.56 | 0.53 | 36 |
| Automobile | 0.64 | 0.57 | 0.61 | 63 |
| BPO | 0.79 | 0.65 | 0.71 | 40 |
| Management | 0.78 | 0.69 | 0.74 | 72 |
| ETL Developer | 0.71 | 0.81 | 0.76 | 59 |
| Architecture | 0.84 | 0.70 | 0.76 | 69 |
| Sales | 0.82 | 0.77 | 0.79 | 73 |
| Python Developer | 0.84 | 0.76 | 0.80 | 49 |
| SQL Developer | 0.79 | 0.84 | 0.81 | 68 |
| DotNet Developer | 0.88 | 0.79 | 0.83 | 66 |
| Database | 0.87 | 0.80 | 0.84 | 51 |
| Designing | 0.81 | 0.86 | 0.84 | 51 |
| Apparel | 0.81 | 0.88 | 0.84 | 64 |
| Food and Beverages | 0.84 | 0.84 | 0.84 | 32 |
| Information Technology | 0.86 | 0.87 | 0.86 | 55 |
| Finance | 0.88 | 0.85 | 0.87 | 68 |
| PMO | 0.83 | 0.91 | 0.87 | 57 |
| Web Designing | 0.93 | 0.82 | 0.87 | 62 |
| Agriculture | 0.81 | 0.95 | 0.88 | 59 |
| Blockchain | 1.00 | 0.78 | 0.88 | 9 |
| Consultant | 0.86 | 0.92 | 0.89 | 74 |
| Building and Construction | 0.94 | 0.87 | 0.90 | 69 |
| Education | 0.90 | 0.90 | 0.90 | 82 |
| Arts | 0.94 | 0.89 | 0.91 | 66 |
| Accountant | 0.88 | 0.96 | 0.92 | 70 |
| Health and Fitness | 0.90 | 0.94 | 0.92 | 66 |
| Advocate | 0.89 | 0.97 | 0.93 | 58 |
| Network Security Engineer | 0.89 | 0.97 | 0.93 | 66 |
| Business Analyst | 1.00 | 0.87 | 0.93 | 68 |
| Java Developer | 0.91 | 0.96 | 0.93 | 70 |
| Testing | 0.92 | 0.96 | 0.94 | 69 |
| Digital Media | 0.96 | 0.93 | 0.94 | 72 |
| Data Science | 0.94 | 0.97 | 0.95 | 60 |
| Banking | 0.93 | 0.98 | 0.95 | 63 |
| Aviation | 0.93 | 0.99 | 0.96 | 68 |
| Civil Engineer | 0.95 | 0.97 | 0.96 | 73 |
| Public Relations | 0.97 | 0.96 | 0.96 | 67 |
| Operations Manager | 0.97 | 0.96 | 0.96 | 69 |
| Human Resources | 0.97 | 0.97 | 0.97 | 72 |
| DevOps | 0.97 | 0.98 | 0.97 | 58 |
| Electrical Engineering | 0.96 | 0.99 | 0.97 | 77 |
| SAP Developer | 1.00 | 0.98 | 0.99 | 61 |
| Mechanical Engineer | 1.00 | 1.00 | 1.00 | 77 |

## Note on methodology

`train_bert.py` uses this same test set as its evaluation set with
`load_best_model_at_end=True`, so the best checkpoint was selected using
these resumes. The score above is therefore slightly optimistic. A separate
validation split would remove this effect.
