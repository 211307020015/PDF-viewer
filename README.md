# PDF预览器

基于PDF.js的PDF文件预览工具，使用Ant Design风格的UI。

## 特性

- 简洁现代的用户界面，基于Ant Design风格
- 支持拖放PDF文件进行预览
- 支持页面导航、缩放控制
- 支持文本搜索功能（针对可搜索的PDF）
- 响应式设计，适配不同设备屏幕
- 键盘快捷键支持

## 快速开始

### 开发环境

```bash
# 安装依赖
npm install

# 启动开发服务器
npm start
```

### 构建生产版本

```bash
# 构建优化后的生产版本
npm run build

# 预览生产版本
npm run serve
```

## 使用方法

1. 点击"选择PDF文件"按钮或将PDF文件拖放到指定区域
2. 使用工具栏上的按钮进行页面导航和缩放
3. 使用搜索框搜索PDF中的文本（仅适用于可搜索的PDF）

## 键盘快捷键

- `← / →`: 上一页/下一页
- `+/-`: 放大/缩小
- `Home/End`: 跳到第一页/最后一页
- `Ctrl+F`: 聚焦搜索框
- `F3`: 查找下一个匹配
- `Shift+F3`: 查找上一个匹配
- `Esc`: 清除搜索

## 技术栈

- [PDF.js](https://mozilla.github.io/pdf.js/) - PDF渲染引擎
- 原生JavaScript - 无框架依赖
- Ant Design - UI设计灵感
- Parcel - 用于打包构建

## 浏览器兼容性

支持所有现代浏览器，包括：
- Chrome
- Firefox
- Safari
- Edge

## 许可证

MIT 