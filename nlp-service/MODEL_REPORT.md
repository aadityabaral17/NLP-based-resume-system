# ARIS NLP Model Performance Report

## Model Overview
- **Algorithm:** Support Vector Machine (SVM) with Linear Kernel
- **Vectorizer:** TF-IDF (max 3000 features)
- **Dataset:** Kaggle Resume Dataset
- **Total Resumes:** 2484
- **Categories:** 24 job categories
- **Train/Test Split:** 80/20

---

## Overall Performance
| Metric | Score |
|--------|-------|
| Accuracy | 63.38% |
| Macro Avg Precision | 61% |
| Macro Avg Recall | 58% |
| Macro Avg F1 | 58% |

---

## Per Category Performance
| Category | Precision | Recall | F1 |
|----------|-----------|--------|----|
| ACCOUNTANT | 0.81 | 0.90 | 0.85 |
| ADVOCATE | 0.50 | 0.57 | 0.53 |
| AGRICULTURE | 0.17 | 0.12 | 0.14 |
| APPAREL | 0.44 | 0.40 | 0.42 |
| ARTS | 0.15 | 0.17 | 0.16 |
| AUTOMOBILE | 0.67 | 0.33 | 0.44 |
| AVIATION | 0.76 | 0.90 | 0.83 |
| BANKING | 0.80 | 0.70 | 0.74 |
| BPO | 0.00 | 0.00 | 0.00 |
| BUSINESS-DEVELOPMENT | 0.79 | 0.56 | 0.65 |
| CHEF | 0.83 | 0.62 | 0.71 |
| CONSTRUCTION | 0.93 | 0.74 | 0.82 |
| CONSULTANT | 0.41 | 0.35 | 0.38 |
| DESIGNER | 0.79 | 0.79 | 0.79 |
| DIGITAL-MEDIA | 0.89 | 0.68 | 0.77 |
| ENGINEERING | 0.57 | 0.62 | 0.59 |
| FINANCE | 0.63 | 0.63 | 0.63 |
| FITNESS | 0.89 | 0.42 | 0.57 |
| HEALTHCARE | 0.35 | 0.55 | 0.43 |
| HR | 0.74 | 0.78 | 0.76 |
| INFORMATION-TECHNOLOGY | 0.56 | 0.88 | 0.69 |
| PUBLIC-RELATIONS | 0.67 | 0.71 | 0.69 |
| SALES | 0.56 | 0.69 | 0.62 |
| TEACHER | 0.67 | 0.73 | 0.70 |

---

## Best Performing Categories
| Category | F1 Score |
|----------|----------|
| ACCOUNTANT | 0.85 |
| AVIATION | 0.83 |
| CONSTRUCTION | 0.82 |
| DESIGNER | 0.79 |
| DIGITAL-MEDIA | 0.77 |

## Weakest Performing Categories
| Category | F1 Score | Reason |
|----------|----------|--------|
| BPO | 0.00 | Very few samples (only 22) |
| ARTS | 0.16 | Overlaps with other categories |
| AGRICULTURE | 0.14 | Very few samples (only 63) |

---

## Key Observations
- Categories with more samples perform better
- BPO and AGRICULTURE suffer from class imbalance
- AVIATION performs well at 0.83 F1 score
- Overall accuracy can be improved with more data

---

## NLP Pipeline
- **Text Extraction:** pdfplumber (PDF), python-docx (DOCX)
- **Preprocessing:** Lowercasing, stop-word removal, lemmatisation (spaCy)
- **Vectorization:** TF-IDF with 3000 features
- **Classification:** SVM Linear Kernel
- **Matching:** Cosine Similarity
- **Skill Gap:** Set difference (JD skills - CV skills)
- **Recommendations:** Frequency-weighted priority scoring