import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import SVC
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import pickle
import spacy

nlp = spacy.load("en_core_web_sm")

# ── Step 1: Load dataset ──────────────────────────────
print("Loading dataset...")
df = pd.read_csv("data/Resume.csv")
print(f"Total resumes: {len(df)}")
print(f"Categories: {df['Category'].nunique()}")
print(df['Category'].value_counts())

# ── Step 2: Clean text ────────────────────────────────
def clean_text(text):
    doc = nlp(text.lower())
    tokens = [
        token.lemma_
        for token in doc
        if not token.is_stop
        and not token.is_punct
        and not token.is_space
        and len(token.text) > 1
    ]
    return " ".join(tokens)

print("\nCleaning resumes... (this takes a few minutes)")
df['cleaned'] = df['Resume_str'].apply(clean_text)
print("Cleaning done!")

# ── Step 3: TF-IDF Vectorization ─────────────────────
print("\nVectorizing text...")
vectorizer = TfidfVectorizer(max_features=3000)
X = vectorizer.fit_transform(df['cleaned'])
y = df['Category']

# ── Step 4: Train/Test Split ──────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)
print(f"Training samples: {len(y_train)}")
print(f"Testing samples:  {len(y_test)}")

# ── Step 5: Train SVM ─────────────────────────────────
print("\nTraining SVM model...")
model = SVC(kernel='linear', probability=True)
model.fit(X_train, y_train)
print("Training complete!")

# ── Step 6: Evaluate ──────────────────────────────────
y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)
print(f"\nAccuracy: {accuracy * 100:.2f}%")
print("\nClassification Report:")
print(classification_report(y_test, y_pred))

# ── Step 7: Save model ────────────────────────────────
print("\nSaving model...")
with open("model.pkl", "wb") as f:
    pickle.dump(model, f)
with open("vectorizer.pkl", "wb") as f:
    pickle.dump(vectorizer, f)
print("✅ model.pkl and vectorizer.pkl saved!")