/**
 * Vercel Serverless 图片代理服务
 * 用于绕过防盗链保护，代理第三方图片资源
 */

export default async function handler(req, res) {
  try {
    // 1. 获取目标图片 URL
    const targetUrl = req.query.url || req.url.split('?url=')[1]?.split('&')[0];

    if (!targetUrl) {
      return res.status(400).json({
        error: 'Missing required parameter: url',
        usage: '/api?url=https://example.com/image.jpg'
      });
    }

    // 解码 URL（处理编码的 URL）
    const decodedUrl = decodeURIComponent(targetUrl);

    // 验证 URL 格式
    let parsedUrl;
    try {
      parsedUrl = new URL(decodedUrl);
    } catch (error) {
      return res.status(400).json({
        error: 'Invalid URL format',
        provided: targetUrl
      });
    }

    // 2. 提取目标域名的 Origin（用于设置 Referer）
    const origin = `${parsedUrl.protocol}//${parsedUrl.host}`;

    // 3. 构造请求头，破解防盗链
    const headers = {
      'Referer': origin + '/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };

    // 4. 发起请求获取图片
    const response = await fetch(decodedUrl, {
      method: 'GET',
      headers: headers,
      redirect: 'follow'
    });

    // 检查响应状态
    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Failed to fetch image from target server',
        status: response.status,
        statusText: response.statusText,
        targetUrl: decodedUrl
      });
    }

    // 5. 获取原始图片的 Content-Type
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // 6. 读取图片数据（Buffer）
    const imageBuffer = await response.arrayBuffer();

    // 7. 设置响应头
    // CORS 头 - 允许跨域访问
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 内容类型
    res.setHeader('Content-Type', contentType);

    // 缓存控制 - 1天 (86400秒)
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=43200');

    // Vercel 边缘缓��
    res.setHeader('CDN-Cache-Control', 'public, max-age=86400');

    // 内容长度
    res.setHeader('Content-Length', imageBuffer.byteLength);

    // 8. 返回图片数据
    return res.status(200).send(Buffer.from(imageBuffer));

  } catch (error) {
    // 错误处理
    console.error('Image proxy error:', error);

    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
