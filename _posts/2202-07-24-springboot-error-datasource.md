---
layout: post
title: error creating bean with name 'datasource', 'dataSourceScriptDatabaseInitializer', 'inmemorydatabaseshutdownexecutor'
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

따끈따끈하게 spring boot 프레임워크를 다루기 시작해서 삽질을 신나게 했다.. application.yml 파일을 열심히 수정해보기도 하고 pom.xml파일도 수정해보고..

그러다가 결국 해결방법을 찾았다!! 🤪

[stackoverflow](https://stackoverflow.com/questions/28042426/spring-boot-error-creating-bean-with-name-datasource-defined-in-class-path-r) << 이 곳을 참고해서 application 자바파일에 <br>
`@EnableAutoConfiguration(exclude = { DataSourceAutoConfiguration.class })`을 추가했다. <br>
~~제일 처음에 본 사이트지만 annotation에 대해서 잘 몰라서 annotation에 필요한 import를 하지 않아서 계속 삽질..~~

--------------------------------
### Error 'inmemorydatabaseshutdownexecutor'
application파일에 추가해준 코드로 문제를 해결한 줄 알았는데, 알고보니까 예외처리로 에러가 뜨지 않는 거였다.. 

그래서 sql과 연동되지 않았다.

어쩔 수 없이 다시 해결책을 찾아보았다. 

먼저 pom.xml에 있는 springboot의 버전을 2.5.0으로 낮추어보았다. 

그러자 이번에는 
>Error 'inmemorydatabaseshutdownexecutor'

오류가 뜨기 시작했다.

그래서 pom.xml에 있는 dependencies를 추가로 더해주었다.
```xml
<!-- Jpa and hibernate -->
<dependency>
    <groupId>org.springframework</groupId>
    <artifactId>spring-orm</artifactId>
</dependency>
<dependency>
    <groupId>org.hibernate</groupId>
    <artifactId>hibernate-entitymanager</artifactId>
</dependency>
<dependency>
    <groupId>mysql</groupId>
    <artifactId>mysql-connector-java</artifactId>
</dependency>
```

그리고..  드디어 에러 해결!!! 🎉