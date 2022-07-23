---
layout: post
title: error creating bean with name 'datasource', 'dataSourceScriptDatabaseInitializer'
subtitle: springboot 오류 해결 일지
categories: springboot
tags: [springboot]
---
## 오류 해결 일지
### Error 'datasource', 'dataSourceScriptDatabaseInitializer'
spring boot로 블로그 만들기 프로젝트 중  
> Error creating bean with name 'dataSourceScriptDatabaseInitializer' 

> Error creating bean with name 'dataSource'

오류가 발생했다..
<br><br>
따끈따끈하게 spring boot 프레임워크를 다루기 시작해서 삽질을 신나게 했다.. application.yml 파일을 열심히 수정해보기도 하고 pom.xml파일도 수정해보고..
<br><br>
그러다가 결국 해결방법을 찾았다!! 🤪

[stackoverflow](https://stackoverflow.com/questions/28042426/spring-boot-error-creating-bean-with-name-datasource-defined-in-class-path-r) << 이 곳을 참고해서 메인스레드인 자바파일에 <br>
`@EnableAutoConfiguration(exclude = { DataSourceAutoConfiguration.class })`을 추가했다. <br>
~~제일 처음에 본 사이트지만 annotation에 대해서 잘 몰라서 annotation에 필요한 import를 하지 않아서 계속 삽질..~~