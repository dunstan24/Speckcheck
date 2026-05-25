FROM python:3.11-slim

WORKDIR /app

# Install dependencies dulu (layer ini di-cache jika requirements.txt tidak berubah)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

EXPOSE 5000

CMD ["python", "app.py"]
