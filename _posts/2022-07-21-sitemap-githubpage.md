---
layout: post
title: Github blog 구글 등록과 sitemap 오류
subtitle: sitemap 오류 해결
categories: github
tags: [github, sitemap]
---

## github blog 구글 검색에 등록하기 

### sitemap url 오류 발생

사이트 인증 후 sitemap 업로드 해서 후딱 끝내려고 했는데, 자꾸 Google Sitemaps의 제출된 사이트맵에서 url 오류가 발생했다.
<br><br>
결국 이 [블로그 글](https://blog.slarea.com/git/blog/register-to-search/)을 참조해서 해결했다.
<br><br>
> 해결 방법은 아래를 따라하면 된다.

### sitemap url 오류 해결

먼저 이 [www.xml-sitemaps.com](https://www.xml-sitemaps.com/)에 접속한다.
<br><br>
![sitmaps](assets/img/xml-sitemaps.jpg)

해당 사이트에서 자신의 url을 입력한다.

![sitempas-parse](assets/img/xml-sitemaps-parse.jpg)

그리고 `DOWNLOAD YOUR XML SITEMAP FILE`을 다운로드한다.
<br><br>
그 후 _config.yml과 같은 위치에 다운받은 sitemap.xml 파일을 붙여놓은 후 commit하고 push!

![google-sitemap](assets/img/google-sitemap.jpg)

그리고 `사이트맵 URL 입력`에 sitemap.xml 입력하면 끝!