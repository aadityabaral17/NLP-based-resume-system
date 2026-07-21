import os
os.environ["HF_HUB_DISABLE_XET"] = "1"

from datasets import load_dataset
import pandas as pd

print("Downloading ResumeAtlas dataset...")
ds = load_dataset("ahmedheakl/resume-atlas")

df = pd.DataFrame(ds['train'])
print(f"Total records: {len(df)}")
print(f"Categories: {df['Category'].nunique()}")
print(df['Category'].value_counts())

df.to_csv("data/ResumeAtlas.csv", index=False)
print("\nSaved to data/ResumeAtlas.csv")
