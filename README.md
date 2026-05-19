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
- **Key / model / date filters** — toggle individual API keys and models, set date range
- **Detail table** — per-key per-model breakdown with summary-only mode, heatmap-style background gradients (column-wise normalization), and green-to-red subtotal text gradient
- **Daily cost chart** — stacked bar chart showing cost breakdown by model per day
- **Cost distribution** — sunburst chart of cost by model and API key; toggle to switch between sunburst, stacked bar, and normalized percentage view (with animated re-sort on legend click)
- **Daily token trends** — line chart tracking each token type over time; dual-axis mode prevents cache-hit from overwhelming the scale
- **API Key token usage** — grouped bar chart per API key; dual-axis support
- **Light / dark theme** — toggle in the header, respects system preference on first visit
- **100% local** — all parsing and chart rendering happens in your browser; nothing is uploaded

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
- **Key / 模型 / 日期筛选** — 可切换显示/隐藏特定 API Key 和模型，设置日期范围
- **明细数据表** — 按 Key 和模型的详细数据，支持仅汇总模式，支持热力图背景色梯度（按列归一化）
- **每日费用图表** — 堆叠柱状图，按模型展示每日费用明细
- **费用分布** — 旭日图展示费用按模型和 Key 的分布；支持切换为堆叠柱状图和归一化百分比视图
- **每日 Token 趋势** — 折线图追踪各类 Token 按日变化；支持双轴模式避免缓存命中挤压其他指标
- **API Key Token 用量** — 按 API Key 的分组柱状图；支持双轴切换
- **亮色 / 暗色主题** — 页面右上角切换，首次访问自动跟随系统设置
- **完全本地** — 所有解析和图表渲染都在你的浏览器中完成，数据不上传

## 隐私

你的用量数据不会离开你的电脑。此页面不含任何分析、追踪或后端服务。你可以在页面加载后断开网络来验证这一点。
