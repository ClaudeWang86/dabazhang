#!/bin/bash
TOKEN="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE3NjgxMDI4NjcsInN1YiI6IntcIm5ldGJhclwiOntcImlkXCI6ODAwMTQsXCJpc0NoYWluXCI6ZmFsc2UsXCJsb2dvXCI6XCJhdmF0YXIvMTc1ODE2MzI1Nl84MDAxNF9hdmF0YXIucG5nXCIsXCJuYW1lXCI6XCLlsI_lppfnlLXnq57ogZTnm5_lpKrliJ3nlLXnq57puL_okpnlupdcIn0sXCJzb3VyY2VcIjo2LFwidXNlclwiOntcImFjY291bnRcIjpcInRjZGpobWQxXCIsXCJhdmF0YXJcIjpcIlwiLFwiZ2lkXCI6ODAwMTQsXCJpZGNhcmRcIjpcIlwiLFwicm9sZWlkXCI6MzcsXCJ0eXBlXCI6MCxcInVuaWFjaWRcIjo4MDAwNCxcInVzZXJJZFwiOjQ5LFwidXNlck5hbWVcIjpcInRjZGpobWQxXCJ9LFwidXNlcklkXCI6NDl9IiwiZXhwIjoxNzY4MjEwODY3LCJuYmYiOjE3NjgxMDI4Njd9.wtEGoasyI-0D0l6L_Si4W7ENqiw5GSVPN3C5Ym5My7E"

curl -s -X POST 'https://www.yisbar.com/good/getOrderSalesByPage' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H 'Accept: application/json' \
  -H 'Origin: https://admin.yisbar.com' \
  -H 'source: 6' \
  -H "token: $TOKEN" \
  -d 'gids[0]=80014&orderId=&curPage=1&pageSize=5&beginTime=2026-01-10 00:00:00&endTime=2026-01-11 00:00:00'
