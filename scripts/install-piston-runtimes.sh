#!/usr/bin/env bash
set -e

PISTON_URL="${1:-http://localhost:2000/api/v2}"

# Danh sách gói ngôn ngữ & phiên bản khớp với RUNTIME_MAP trong sandbox.service.ts
PACKAGES=(
  '{"language":"node","version":"18.15.0"}'
  '{"language":"typescript","version":"5.0.3"}'
  '{"language":"python","version":"3.10.0"}'
  '{"language":"java","version":"15.0.2"}'
  '{"language":"mono","version":"6.12.0"}'
  '{"language":"gcc","version":"10.2.0"}'
  '{"language":"go","version":"1.16.2"}'
)

echo "Đang kết nối tới Piston Sandbox tại $PISTON_URL..."

for pkg in "${PACKAGES[@]}"; do
  echo "-> Đang cài đặt gói: $pkg"
  curl -s -X POST "$PISTON_URL/packages" \
    -H "Content-Type: application/json" \
    -d "$pkg"
  echo ""
done

echo "Hoàn tất cài đặt! Danh sách runtime đã sẵn sàng trên Sandbox:"
curl -s "$PISTON_URL/runtimes"
echo ""