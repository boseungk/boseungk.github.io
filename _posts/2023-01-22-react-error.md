---
layout: post
title: React 오류(npm ERR! Missing script: "start")
subtitle: React 오류 처리
categories: React
tags: [React]
---

## React 오류 처리 

간단하게 React를 학습하려고 설치하고 실행하는 도중 에러가 발생했다.

그래서 구글링해서 해결하긴 했는데 

오류 원인과 해결방법을 간단하게 남기기 위해서 포스팅을 남기게 되었다.

### npm ERR! Missing script: "start" 


![errorImage](https://user-images.githubusercontent.com/95980754/213915432-137ec9aa-13ec-4388-9227-b4cc5bec962b.png)

npm ERR! Missing script: "start" 이라는 에러가 발생했다.

에러의 원인을 간단하게 말하자면 잘못된 경로에서 npm start를 했기 때문에 에러가 발생했다.

`npx create-react-app 폴더이름`으로 react-app을 설치했기 때문에 해당 `폴더이름` 위치로 이동해서 npm start를 해주면 잘 실행된다.

