# PDF预览器部署指南

本文档提供了部署PDF预览器应用程序的详细说明。

## 打包应用

项目使用Parcel打包工具生成静态网站文件。完整的打包步骤如下：

```bash
# 安装依赖
npm install

# 清理旧的构建文件
npm run clean

# 构建生产版本
npm run build
```

构建完成后，所有生产文件都将被放置在`dist`目录中。

## 部署选项

### 1. 本地测试服务器

要在本地测试部署，可以使用内置的服务器：

```bash
npm run serve
```

这将启动一个本地服务器（通常在http://localhost:3000），展示生产版本的应用程序。

### 2. 静态文件托管服务

您可以将`dist`目录中的所有文件部署到任何静态文件托管服务，例如：

- GitHub Pages
- Netlify
- Vercel
- AWS S3
- 传统Web主机

#### 部署到GitHub Pages

1. 在GitHub上创建仓库
2. 将项目推送到仓库
3. 在仓库设置中，启用GitHub Pages，并选择`gh-pages`分支或`docs`文件夹
4. 通过以下命令将`dist`文件夹内容复制到`docs`文件夹：
   ```bash
   mkdir -p docs
   cp -r dist/* docs/
   ```
5. 提交并推送更改

#### 部署到Netlify/Vercel

1. 注册Netlify/Vercel账户
2. 导入您的Git仓库
3. 设置构建命令为`npm run build`
4. 设置发布目录为`dist`
5. 点击部署

### 3. 传统Web服务器

如果您使用Apache、Nginx等传统Web服务器：

1. 将`dist`目录中的所有文件复制到Web服务器的文档根目录
2. 确保服务器正确配置了MIME类型，特别是对于JavaScript和PDF文件

## 注意事项

- 应用程序是一个纯前端应用，不需要后端服务器
- 所有PDF处理都在用户的浏览器中进行，不会将文件上传到服务器
- 如果您的部署路径不是网站根目录，请确保更新`public-url`参数：
  ```
  parcel build index.html --public-url ./your-subdirectory/ --no-minify
  ``` 