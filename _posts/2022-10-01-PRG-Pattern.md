---
layout: post
title: PRG(Post-Redirect-Get) Pattern
subtitle: PRG Pattern에 대해 알아보자
categories: web mvc
tags: [web mvc]
---

## PRG Pattern

### PRG Pattern이란?

웹 MVC 구조에서 가장 흔하게 쓰는 패턴으로 Post 방식과 Redirect후 Get방식을 사용하는 PRG 패턴이다.

다음과 같은 흐름으로 요약해볼 수 있다.

    1. 사용자는 Post 방식으로 (컨트롤러에게) 원하는 방식을 요청

    2. Post 방식을 컨트롤러에서 처리한 후 브라우저를 다른 경로로 이동(Get)하라는 응답(Redirect)
   
    3. 브라우저는 Get 방식으로 이동하게 됨

PRG 패턴의 예시로는 게시글이나 로그인등 다양하다. 

예를 들어 

    1. 사용자가 새로운 글을 작성하고 Post 방식으로 전송

    2. 서버에서 Post를 처리한 후 글 목록으로 브라우저를 Redirect

    3. 브라우저에서 Get 방식으로 게시글 리스트를 보여주고 사용자는 글 작성 결과를 확인


