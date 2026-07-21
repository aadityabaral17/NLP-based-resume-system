import torch
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, classification_report, f1_score
from transformers import (
    BertTokenizer, BertForSequenceClassification,
    Trainer, TrainingArguments
)
from torch.utils.data import Dataset
import pickle

# ─── Device detection ─────────────────────────────────
if torch.cuda.is_available():
    device = "cuda"
    print(f"Using CUDA GPU: {torch.cuda.get_device_name(0)}")
elif torch.backends.mps.is_available():
    device = "mps"
    print("Using Apple Silicon MPS")
else:
    device = "cpu"
    print("Using CPU (this will be slow)")

# ─── Load dataset ──────────────────────────────────────
print("\nLoading dataset...")
df = pd.read_csv("data/ResumeAtlas.csv")
df = df.dropna(subset=["Text", "Category"])
print(f"Total resumes: {len(df)}")
print(f"Categories: {df['Category'].nunique()}")

# ─── Encode labels ─────────────────────────────────────
le = LabelEncoder()
df["label"] = le.fit_transform(df["Category"])
num_labels = len(le.classes_)

with open("bert_label_encoder.pkl", "wb") as f:
    pickle.dump(le, f)

# ─── Train/test split ──────────────────────────────────
train_df, test_df = train_test_split(
    df, test_size=0.2, random_state=42, stratify=df["label"]
)
print(f"Training samples: {len(train_df)}")
print(f"Testing samples:  {len(test_df)}")

# ─── Tokenizer ──────────────────────────────────────────
print("\nLoading tokenizer and base BERT model...")
tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")

class ResumeDataset(Dataset):
    def __init__(self, texts, labels, tokenizer, max_length=256):
        self.texts = texts.tolist()
        self.labels = labels.tolist()
        self.tokenizer = tokenizer
        self.max_length = max_length

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, idx):
        encoding = self.tokenizer(
            str(self.texts[idx]),
            truncation=True,
            padding="max_length",
            max_length=self.max_length,
            return_tensors="pt"
        )
        return {
            "input_ids": encoding["input_ids"].squeeze(),
            "attention_mask": encoding["attention_mask"].squeeze(),
            "labels": torch.tensor(self.labels[idx], dtype=torch.long)
        }

train_dataset = ResumeDataset(train_df["Text"], train_df["label"], tokenizer)
test_dataset = ResumeDataset(test_df["Text"], test_df["label"], tokenizer)

# ─── Model — fine-tune from base BERT (this is YOUR training) ──
model = BertForSequenceClassification.from_pretrained(
    "bert-base-uncased",
    num_labels=num_labels
)
model.to(device)

# ─── Training arguments ────────────────────────────────
training_args = TrainingArguments(
    output_dir="./bert_checkpoints",
    num_train_epochs=3,
    per_device_train_batch_size=8,
    per_device_eval_batch_size=8,
    warmup_steps=200,
    weight_decay=0.01,
    logging_dir="./bert_logs",
    logging_steps=50,
    eval_strategy="epoch",
    save_strategy="epoch",
    load_best_model_at_end=True,
    metric_for_best_model="f1",
    fp16=(device == "cuda"),  # mixed precision only helps on CUDA
)

def compute_metrics(eval_pred):
    predictions, labels = eval_pred
    preds = np.argmax(predictions, axis=1)
    acc = accuracy_score(labels, preds)
    f1 = f1_score(labels, preds, average="weighted")
    return {"accuracy": acc, "f1": f1}

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=test_dataset,
    compute_metrics=compute_metrics,
)

# ─── Train ──────────────────────────────────────────────
print("\nStarting fine-tuning...")
trainer.train()

# ─── Evaluate ───────────────────────────────────────────
print("\nEvaluating on test set...")
eval_results = trainer.evaluate()
print(f"Accuracy: {eval_results['eval_accuracy']:.4f}")
print(f"F1 Score: {eval_results['eval_f1']:.4f}")

predictions = trainer.predict(test_dataset)
preds = np.argmax(predictions.predictions, axis=1)
print("\nClassification Report:")
print(classification_report(test_df["label"], preds, target_names=le.classes_))

# ─── Save final model ───────────────────────────────────
print("\nSaving fine-tuned model...")
model.save_pretrained("./bert_resume_model")
tokenizer.save_pretrained("./bert_resume_model")
print("Saved to ./bert_resume_model/")