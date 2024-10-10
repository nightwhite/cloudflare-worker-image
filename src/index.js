import queryString from 'query-string';
import * as photon from '@silvia-odwyer/photon';
import PHOTON_WASM from '../node_modules/@silvia-odwyer/photon/photon_rs_bg.wasm';
import encodeWebp, { init as initWebpWasm } from '@jsquash/webp/encode';
import WEBP_ENC_WASM from '../node_modules/@jsquash/webp/codec/enc/webp_enc.wasm';

// 图片处理
const photonInstance = await WebAssembly.instantiate(PHOTON_WASM, {
	'./photon_rs_bg.js': photon,
});
photon.setWasm(photonInstance.exports);
await initWebpWasm(WEBP_ENC_WASM);
const OUTPUT_FORMATS = {
	jpeg: 'image/jpeg',
	jpg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
};

const multipleImageMode = ['watermark', 'blend'];

const inWhiteList = (env, url) => {
	const imageUrl = new URL(url);
	const whiteList = env.WHITE_LIST ? env.WHITE_LIST.split(',') : [];
	return !(whiteList.length && !whiteList.find((hostname) => imageUrl.hostname.endsWith(hostname)));
};

const processImage = async (env, request, inputImage, pipeAction) => {
	await initWebpWasm(WEBP_ENC_WASM);
	try {
		const [action, options = ''] = pipeAction.split('!');
		const params = options.split(',');
		if (multipleImageMode.includes(action)) {
			const image2 = params.shift();
			if (image2 && inWhiteList(env, image2)) {
				const image2Res = await fetch(image2, { headers: request.headers });
				if (image2Res.ok) {
					const inputImage2 = photon.PhotonImage.new_from_byteslice(new Uint8Array(await image2Res.arrayBuffer()));
					// 如果 action 是 watermark，且 坐标是负数，那么就从右下角开始计算
					if (action === 'watermark' && parseInt(params[0], 10) < 0) {
						params[0] = inputImage.get_width() - inputImage2.get_width() + parseInt(params[0], 10);
					}
					// 如果 action 是 watermark，且 坐标是负数，那么就从右下角开始计算
					if (action === 'watermark' && parseInt(params[1], 10) < 0) {
						params[1] = inputImage.get_height() - inputImage2.get_height() + parseInt(params[1], 10);
					}

					photon[action](inputImage, inputImage2, ...params);
					return inputImage; // 返回处理后的图像
				} else {
					console.error('Failed to fetch second image:', image2Res.status);
				}
			}
		} else {
			return photon[action](inputImage, ...params);
		}
	} catch (error) {
		console.error('Error in processImage:', error);
	}
	return inputImage; // 确保始终返回一个值
};

export default {
	async fetch(request, env, context) {
		// 读取缓存
		const cacheUrl = new URL(request.url);
		const cacheKey = new Request(cacheUrl.toString());
		const cache = caches.default;
		const hasCache = await cache.match(cacheKey);
		if (hasCache) {
			console.log('cache: true');
			return hasCache;
		}

		// 入参提取与校验
		const query = queryString.parse(new URL(request.url).search);
		const action = query.action || '';
		const format = query.format || 'webp';
		const quality = query.quality !== undefined ? query.quality : format === 'webp' ? 85 : 99;

		// 固定基础 URL
		const baseImageUrl = 'https://www.hysli-cos.top';
		const imagePath = cacheUrl.pathname;
		const url = `${baseImageUrl}${imagePath}`;
		console.log('params:', url, action, format, quality);

		if (!url) {
			return new Response(null, {
				status: 302,
				headers: {
					location: 'https://hysli.ai',
				},
			});
		}

		// 白名单检查
		if (!inWhiteList(env, url)) {
			console.log('whitelist: false');
			return new Response(null, {
				status: 403,
			});
		}

		// 目标图片获取与检查
		const imageRes = await fetch(url, { headers: request.headers });
		if (!imageRes.ok) {
			return imageRes;
		}
		console.log('fetch image done');

		const imageBytes = new Uint8Array(await imageRes.arrayBuffer());
		try {
			const inputImage = photon.PhotonImage.new_from_byteslice(imageBytes);
			console.log('create inputImage done');

			/** pipe
			 * `resize!800,400,1|watermark!https%3A%2F%2Fmt.ci%2Flogo.png,10,10,10,10`
			 */
			const pipe = action.split('|');
			const outputImage = await pipe.filter(Boolean).reduce(async (result, pipeAction) => {
				result = await result;
				return (await processImage(env, request, result, pipeAction)) || result;
			}, inputImage);
			console.log('create outputImage done');

			// 图片编码
			let outputImageData;
			if (format === 'jpeg' || format === 'jpg') {
				outputImageData = outputImage.get_bytes_jpeg(quality);
			} else if (format === 'png') {
				outputImageData = outputImage.get_bytes();
			} else {
				outputImageData = await encodeWebp(outputImage.get_image_data(), { quality });
			}

			// 检查是否为 WebP 格式

			let imageResponse;
			const mimeType = imageRes.headers.get('content-type');

			if (mimeType && mimeType.includes('image/webp')) {
				console.log('Image is already in WebP format, returning directly.');
				imageResponse = new Response(imageBytes, {
					headers: {
						'content-type': OUTPUT_FORMATS.webp,
						'cache-control': 'public,max-age=15552000',
					},
				});
			} else {
				console.log('create outputImageData done');

				// 返回体构造
				imageResponse = new Response(outputImageData, {
					headers: {
						'content-type': OUTPUT_FORMATS[format],
						'cache-control': 'public,max-age=15552000',
					},
				});
			}

			// 释放资源
			inputImage.ptr && inputImage.free();
			outputImage.ptr && outputImage.free();
			console.log('image free done');

			// 写入缓存
			context.waitUntil(cache.put(cacheKey, imageResponse.clone()));
			return imageResponse;
		} catch (error) {
			console.error('process:error', error.name, error.message, error);
			const errorResponse = new Response(imageBytes || null, {
				headers: imageRes.headers,
				status: 'RuntimeError' === error.name ? 415 : 500,
			});
			return errorResponse;
		}
	},
};
