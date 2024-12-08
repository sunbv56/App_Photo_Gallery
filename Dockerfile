# 1. Chọn base image Python 3.8
FROM python:3.8-slim

# 2. Đặt thư mục làm việc trong container
WORKDIR /app

# 3. Sao chép tất cả mã nguồn vào container
COPY . /app

# 4. Cài đặt các thư viện Python từ requirements.txt
RUN pip install -r requirements.txt

# 5. Mở port 5000 cho ứng dụng Flask
EXPOSE 5500

# 6. Chạy ứng dụng Flask với Gunicorn
CMD ["gunicorn", "-b", "0.0.0.0:5500", "app:app"]