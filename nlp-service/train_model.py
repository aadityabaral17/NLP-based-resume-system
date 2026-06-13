import pandas as pd
import pickle
import re
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
from sklearn.preprocessing import LabelEncoder
from sklearn.pipeline import Pipeline
from sklearn.calibration import CalibratedClassifierCV
import spacy

print("Loading spaCy model...")
nlp = spacy.load("en_core_web_sm")

# ─── STEP 1: Load dataset ────────────────────────────
print("Loading dataset...")
df = pd.read_csv("data/Resume.csv")
print(f"Total resumes: {len(df)}")
print(f"Categories: {df['Category'].nunique()}")

# ─── STEP 2: Remove categories with too few samples ──
min_samples = 30
category_counts = df['Category'].value_counts()
valid_categories = category_counts[category_counts >= min_samples].index
df = df[df['Category'].isin(valid_categories)]
print(f"After filtering: {len(df)} resumes, {df['Category'].nunique()} categories")

# ─── STEP 3: Clean text ──────────────────────────────
def clean_text(text):
    if not isinstance(text, str):
        return ""
    text = re.sub(r'http\S+|www\S+', '', text)
    text = re.sub(r'\S+@\S+', '', text)
    text = re.sub(r'[^a-zA-Z\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    text = text.lower()
    doc = nlp(text)
    tokens = [
        token.lemma_
        for token in doc
        if not token.is_stop
        and not token.is_punct
        and not token.is_space
        and len(token.text) > 2
    ]
    return " ".join(tokens)

print("Cleaning text... (this takes 2-3 minutes)")
df['cleaned_text'] = df['Resume_str'].apply(clean_text)
print("Text cleaning done!")

# ─── STEP 4: Encode labels ───────────────────────────
le = LabelEncoder()
df['label'] = le.fit_transform(df['Category'])
print(f"Label classes: {list(le.classes_)}")

# ─── STEP 5: TF-IDF vectorization ───────────────────
print("Vectorizing...")
vectorizer = TfidfVectorizer(
    max_features=15000,
    ngram_range=(1, 3),
    sublinear_tf=True,
    min_df=2,
    analyzer='word',
    strip_accents='unicode'
)

X = vectorizer.fit_transform(df['cleaned_text'])
y = df['label']
print(f"Feature matrix shape: {X.shape}")

# ─── STEP 6: Train/test split ────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.2,
    random_state=42,
    stratify=y
)
print(f"Training samples: {X_train.shape[0]}")
print(f"Testing samples:  {X_test.shape[0]}")

# ─── STEP 7: Train LinearSVC ─────────────────────────
print("Training SVM classifier...")
svm = LinearSVC(
    C=2.0,
    max_iter=3000,
    random_state=42,
    class_weight='balanced'
)
svm.fit(X_train, y_train)
print("Training done!")

# ─── STEP 8: Evaluate ────────────────────────────────
print("\nEvaluating model...")
y_pred = svm.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)
print(f"\nAccuracy: {accuracy:.4f} ({accuracy*100:.2f}%)")
print("\nClassification Report:")
print(classification_report(
    y_test, y_pred,
    target_names=le.classes_
))

# ─── STEP 9: Save model ──────────────────────────────
print("Saving model and vectorizer...")
with open("model.pkl", "wb") as f:
    pickle.dump(svm, f)
with open("vectorizer.pkl", "wb") as f:
    pickle.dump(vectorizer, f)
with open("label_encoder.pkl", "wb") as f:
    pickle.dump(le, f)

print("Saved: model.pkl, vectorizer.pkl, label_encoder.pkl")
print("\nTraining complete!")