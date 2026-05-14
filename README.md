[中文](#chinese)

# DeepSeek Usage Chart

A simple, self-contained HTML page that visualizes your monthly DeepSeek API usage and cost data. Everything runs locally in the browser — no data is ever uploaded anywhere.

## How to use

1. Go to [DeepSeek Platform](https://platform.deepseek.com) → Usage Details → Export Records
2. Download the monthly usage **ZIP** file
3. Open `index.html` in your browser
4. Drag and drop the ZIP file onto the page (or click to select it)

## Features

- **Upload a ZIP** — directly load the ZIP you downloaded from DeepSeek, no need to extract it first
- **Summary cards** — total cost, cache hit rate, output/input token counts at a glance
- **Daily cost chart** — stacked bar chart showing cost breakdown by model per day
- **Token distribution** — doughnut chart of output vs. cache-hit vs. cache-miss tokens
- **Daily token trends** — line chart tracking each token type over time
- **Per-API-key breakdown** — cost comparison and token usage for each API key name
- **Key filter** — toggle individual API keys on/off to focus on specific ones
- **100% local** — all parsing and chart rendering happens in your browser

## Privacy

Your usage data never leaves your computer. The page has no analytics, no tracking, and no backend. You can verify this by inspecting the source or disconnecting your network after the page loads.

---

## <a id="chinese"></a>中文

# DeepSeek 用量图表

一个简单的独立 HTML 页面，可视化你的 DeepSeek API 月度用量和费用数据。所有处理都在浏览器本地完成，数据不会上传到任何服务器。

## 使用方法

1. 前往 [DeepSeek 平台](https://platform.deepseek.com) → 用量明细 → 导出记录
2. 下载月度用量的 **ZIP** 文件
3. 用浏览器打开 `index.html`
4. 将 ZIP 文件拖拽到页面上（或点击选择文件）

## 功能

- **上传 ZIP** — 直接加载从 DeepSeek 下载的 ZIP 文件，无需提前解压
- **概览卡片** — 总费用、缓存命中率、输入/输出 Token 数量一目了然
- **每日费用图表** — 堆叠柱状图，按模型展示每日费用明细
- **Token 分布** — 环形图展示输出、缓存命中、缓存未命中 Token 的比例
- **每日 Token 趋势** — 折线图追踪各类 Token 的时间趋势
- **按 API Key 统计** — 每个 API Key 的费用对比和 Token 用量
- **Key 筛选** — 可切换显示/隐藏特定 API Key，聚焦关注的数据
- **完全本地** — 所有解析和图表渲染都在你的浏览器中完成

## 隐私

你的用量数据不会离开你的电脑。此页面不含任何分析、追踪或后端服务。你可以在页面加载后断开网络来验证这一点。
