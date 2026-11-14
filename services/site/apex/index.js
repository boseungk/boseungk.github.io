export default {
  fetch(request) {
    const url = new URL(request.url);
    return new Response(null, { status: 301, headers: {
      Location: `https://www.myanimalroom.com${url.pathname}${url.search}`,
      'Strict-Transport-Security': 'max-age=31556952',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    } });
  },
};
