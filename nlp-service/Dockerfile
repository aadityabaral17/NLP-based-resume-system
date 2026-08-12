# FastAPI NLP service: spaCy, fine-tuned BERT and all-MiniLM-L6-v2.
#
# This tier cannot run on Vercel. The installed dependencies plus the model
# weights come to roughly 1.7 GB against a 250 MB serverless limit, and loading
# the models takes about twelve seconds, which a serverless cold start cannot
# absorb. It needs a long-running container: Hugging Face Spaces (free, 16 GB
# RAM), Render, Railway or Fly.io.

FROM python:3.11-slim

# Hugging Face Spaces serves on 7860; Render and Railway inject $PORT.
# Defaulting here lets the same image run on either without a rebuild.
ENV PORT=7860 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/tmp/huggingface \
    SENTENCE_TRANSFORMERS_HOME=/tmp/huggingface

WORKDIR /app

# Install the CPU-only torch build before anything that depends on torch, so
# sentence-transformers and transformers resolve against it instead of pulling
# the default CUDA wheel.
RUN pip install --no-cache-dir \
      --index-url https://download.pytorch.org/whl/cpu \
      torch

COPY requirements-prod.txt .
RUN pip install --no-cache-dir -r requirements-prod.txt \
 && python -m spacy download en_core_web_sm

# main.py loads these at import time, so the service will not start without
# them. bert_resume_model is about 418 MB; on Hugging Face Spaces it must be
# tracked with Git LFS.
COPY main.py llm_client.py llm_tasks.py ./
COPY bert_label_encoder.pkl ./
COPY bert_resume_model ./bert_resume_model

# The model cache directories must be writable. Spaces runs the container as a
# non-root user, and the default HF cache path is not writable there.
RUN mkdir -p /tmp/huggingface && chmod -R 777 /tmp/huggingface

EXPOSE 7860

# Shell form so ${PORT} is expanded at runtime rather than baked in.
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT}
