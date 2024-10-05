# Cloudflare Worker Image

使用 Cloudflare Worker 处理图片，依赖 Photon，支持缩放、剪裁、水印、滤镜等功能。

---

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-F69652?style=flat&logo=cloudflare&logoColor=white)
![GitHub License](https://img.shields.io/github/license/ccbikai/cloudflare-worker-image)
![GitHub Repo stars](https://img.shields.io/github/stars/ccbikai/cloudflare-worker-image)

> 已经适配了 Vercel Edge, 见 <https://github.com/ccbikai/vercel-edge-image> 。

## 支持特性

1. 支持 PNG、JPEG、BMP、ICO、TIFF 格式图片处理
2. 可输出 JPEG、PNG、WEBP 格式图片，默认输出 WEBP 格式图片
3. 支持管道操作，可以执行多个操作
4. 支持 Cloudflare 缓存
5. 支持图片地址白名单，防滥用
6. 异常降级，如果处理失败返回原图（异常场景不缓存）

## 部署方式

```sh
# patch 功能依赖 pnpm, 如果不使用 pnpm, 需要自己处理 patch-package https://www.npmjs.com/package/patch-package
npm i -g pnpm

# 克隆此项目
git clone https://github.com/ccbikai/cloudflare-worker-image.git
cd cloudflare-worker-image

# 安装依赖
pnpm install

# 修改白名单配置，改为图片域名或者留空不限制图片地址
vi wrangler.toml # WHITE_LIST

# 发布
npm run deploy
```

## 使用方式

### action 参数

#### 1. resize

调整图像大小。

##### resize 用法

resize!<width>,<height>,<mode>

markdown

复制

##### resize 参数

- **width**: 目标宽度（像素）。
- **height**: 目标高度（像素）。
- **mode**: 压缩算法，默认填 2 即可

##### 示例

resize!800,400,2

#### 2. watermark

在图像上添加水印。

##### watermark 用法

watermark!<watermarkImageUrl>,<x>,<y>,<width>,<height>

##### watermark 参数

- **watermarkImageUrl**: 水印图像的 URL。
- **x**: 水印的 x 坐标（像素）。
- **y**: 水印的 y 坐标（像素）。
- **width**: 水印的宽度（像素）。
- **height**: 水印的高度（像素）。

##### 示例

watermark!https%3A%2F%2Fhysli.ai%2Fassets%2Flogo_orange.81cf6e62.png,10,10,10,10

## 其他操作

可以组合多个操作，使用 `|` 分隔，例如：

resize!800,400,1|watermark!https%3A%2F%2Fhysli.ai%2Fassets%2Flogo_orange.81cf6e62.png,10,10,10,10
