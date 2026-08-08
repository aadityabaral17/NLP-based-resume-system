# Model Comparison — SVM vs BERT vs LLM

All three models classify the **same** resumes: a stratified sample of the
held-out test split (`test_size=0.2, random_state=42`), with
5 resumes from each of the 43 categories.

The LLM needs roughly two seconds per resume, so scoring the full 2678-resume
test set would take about ninety minutes. The sample keeps every category
represented while staying practical to run. Because the sample is smaller than
the full test set, these accuracies differ slightly from those in
`BERT_REPORT.md` and `SVM_BASELINE_REPORT.md` — compare the numbers in this
table with each other, not across reports.

## Results

Sample size: **215 resumes**, 43 categories.

| Model | Accuracy | Macro F1 | ms / resume | Relative speed |
|-------|----------|----------|-------------|----------------|
| TF-IDF + LinearSVC | 83.26% | 0.8290 | 0.5 | 1x |
| Fine-tuned BERT | 86.51% | 0.8608 | 15.2 | 29x |
| Zero-shot qwen/qwen3-4b-2507 | 65.12% | 0.6496 | 1097.8 | 2122x |

## Where the LLM fails: it invents categories

On **23 of 215** resumes (10.7%) the model
answered with a job title that is **not one of the 43 allowed categories**,
despite the prompt listing them and instructing it to copy one exactly.
These are counted as wrong.

| True category | What the model answered |
|---------------|-------------------------|
| Advocate | `Customer Service` |
| Advocate | `Customer Service` |
| Agriculture | `Front Desk Receptionist` |
| Agriculture | `Veterinary Assistant` |
| Apparel | `Retail` |
| BPO | `Customer Relations Specialist` |
| BPO | `Customer Service` |
| BPO | `Customer Service` |
| Database | `Project Manager` |
| Designing | `Instructional Designer` |
| Digital Media | `Graphic Designer` |
| Digital Media | `Marketing` |
| Digital Media | `Social Media Manager` |
| Electrical Engineering | `Maintenance Technician` |
| Finance | `Customer Service` |

Most of these are *reasonable descriptions of the resume* — 'Graphic Designer'
for a Digital Media CV, 'Retail' for an Apparel one. The model understands the
document; it will not stay inside the taxonomy. A trained classifier cannot make
this mistake, because its output layer only has the 43 valid classes.

This is the practical argument for keeping BERT: correctness here is a property
of the model architecture, not of prompt wording.

## Notes

- The LLM returned a category outside the allowed list **23** time(s) out of 215; those count as wrong answers.
- The LLM is *zero-shot*: it has never seen this training data. BERT and SVM
  were both trained on 10,711 resumes from the same distribution, so this is
  not a like-for-like contest — it measures whether a general model can
  substitute for a task-specific trained one.
- Temperature is 0.0 for the LLM, so its answers are as deterministic as the
  runtime allows.
