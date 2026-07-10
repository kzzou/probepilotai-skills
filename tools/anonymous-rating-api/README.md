# 匿名评分 API

这是 ProbePilotAI 技能评分的 Cloudflare Workers + D1 参考实现。
上位机只发送 `skill_id`、1～5 分、版本和本机生成的匿名 `device_id`，不需要 GitHub 登录。

## 部署

1. 创建 Cloudflare D1 数据库。
2. 使用 `wrangler.toml.example` 创建 `wrangler.toml`，填入数据库 ID。
3. 执行 `wrangler d1 execute probepilotai-ratings --remote --file=schema.sql`。
4. 设置 `RATING_SALT` 和 `RATING_EXPORT_TOKEN` 两个 Worker secret。
5. 执行 `wrangler deploy`。
6. 将提交地址配置为 `https://<worker-domain>/v1/ratings`。
7. 将导出地址和 `RATING_EXPORT_TOKEN` 配置到技能仓库的 GitHub Actions secrets。

也可以在技能仓库配置 `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID` 后，手动运行
`.github/workflows/deploy-anonymous-rating-api.yml` 部署 Worker。部署完成后，将 Worker
地址写入 `registry.json` 的 `rating_api.submit_url`，或在上位机启动环境设置
`PROBEPILOT_RATING_API_URL`。

## API

### `POST /v1/ratings`

请求体：

```json
{
  "skill_id": "probepilot-flash",
  "rating": 5,
  "version": "1.0.0",
  "device_id": "本机持久化的随机 UUID"
}
```

同一匿名设备对同一技能重复评分时执行更新，不创建新票。

### `GET /v1/ratings/export`

必须携带 `Authorization: Bearer <RATING_EXPORT_TOKEN>`，仅供 GitHub Actions 使用。
返回的 `voter_hash` 是带服务端盐的不可逆哈希，不包含 IP 或原始设备 ID。
