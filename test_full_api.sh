#!/bin/bash

# Step 1: Login to get token
echo "=== 登录获取 Token ==="
LOGIN_RESPONSE=$(curl -s -X POST 'https://www.yisbar.com/netbar/login/web/code' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H 'Accept: application/json' \
  -H 'Origin: https://admin.yisbar.com' \
  -H 'source: 6' \
  -d 'account=tcdjhmd1&password=147258&verifycode=')

echo "$LOGIN_RESPONSE" | python3 -m json.tool 2>/dev/null | head -20

# Extract token
TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['token'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "获取 token 失败"
  exit 1
fi

echo ""
echo "=== Token 获取成功 ==="
echo "Token: ${TOKEN:0:50}..."

echo ""
echo "=== 测试商品销售 API ==="
curl -s -X POST 'https://www.yisbar.com/good/getOrderSalesByPage' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H 'Accept: application/json' \
  -H 'Origin: https://admin.yisbar.com' \
  -H 'source: 6' \
  -H "token: $TOKEN" \
  -d 'gids[0]=80014&orderId=&curPage=1&pageSize=3&beginTime=2026-01-10 00:00:00&endTime=2026-01-11 00:00:00' | python3 -m json.tool 2>/dev/null | head -80
