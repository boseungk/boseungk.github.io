---
layout: post
title: 데이터베이스(Database) 기본 개념
subtitle: 데이터베이스 기본 개념 정리
categories: Database
tags: [Database]
---

### 데이터베이스란?

- 데이터의 중복을 없애고, 데이터를 구조화하여 저장함으로써 자료 검색과 갱신의 효율을 높인 데이터의 집합체

### DBMS(DataBase Management System)

- 데이터를 편리하게 저장하고 갱신, 관리할 수 있도록 기능을 제공해주는 소프트웨어

### 파일시스템의 문제

- 대용량의 데이터를 주기억장치에 저장하기 어려움
- 동일한 데이터에 불일치의 문제가 발생함(데이터 무결성 보장x)
- 에러 발생 시 복구가 어려울 수 있음
- 한정된 보안

### DBMS 장점

- 데이터 독립성, 무결성, 안정성 보장
- 데이터 동시 접근, 효율적 접근
- 데이터 관리(데이터 일관성, 중복, 보안 등)

### 데이터 모델

- 데이터의 의미와 데이터의 관계, 제약조건 등을 기술하기 위한 개념들의 집합
- 종류
    - 관계 데이터 모델
    - 개념 데이터 모델
    - 계층 모델
    - 네트워크 모델
    - 객체지향 모델
    - 객체-관계 모델

### 관계 모델

- 릴레이션
    - record들의 집합
    - 열과 행으로 구성된 2차원 구조의 테이블
- 스키마
    - 개체의 이름, 개체의 속성, 개체 간의 관계와 같이 데이터베이스의 논리적 구조를 정의하는 개념
- 인스턴스
    - 데이터베이스의 특정시점의 snapshot으로, 스키마에 맞는 데이터들의 집합

### Data 추상화 단계

- 데이터 정의어(DDL)
    - 외부 스키마와 개념 스키마를 정의하기 위해 사용되는 언어
- 물리적 스키마
    - 물리적 장치에 실제로 저장하는 방법을 정의하는 구조
- 개념 스키마
    - 데이터 구조와 관계를 기술하는 논리적 구조
- 외부 스키마
    - 사용자나 응용프로그램이 접근하는 데이터베이스의 일부분인 뷰를 정의

### 데이터 독립성

- 논리적 데이터 독립성
    - 데이터베이스의 논리적 구조가 변경되더라도 응용 프로그램이나 사용자에게 영향을 미치지 않고 독립적으로 작동할 수 있는 능력
- 물리적 데이터 독립성
    - 데이터베이스의 물리적 구조가 변경되더라도 응용 프로그램이나 사용자에게 영향을 미치지 않고 독립적으로 작동할 수 있는 능력

### 데이터 정의어

- DDL(Data Definition Language): 스키마의 구조를 정의하거나 변경하기 위한 언어
- DML(Data Manipulation Language): 데이터를 삽입, 수정, 삭제, 조회하기 위한 언어
- DCL(Data Control Language): 데이터베이스의 권한을 부여하기 위한 언어

### 병행 제어(Concurrency Control)

- 데이터에 동시 접근할 때, 데이터의 무결성을 유지하기 위한 기술
    - 여러 사용자가 데이터에 동시 접근할 때, 데이터의 모순을 방지하기 위해서 트랜잭션을 사용하여 데이터 무결성 유지

### 트랜잭션

- 데이터베이스에서 수행되는 작업 단위
- 완전히 수행되거나 전혀 수행되지 않아야 함
- 직렬적, 순차적 접근
- 순서대로 처리하기 위해서 잠금 프로토콜(lock protocol)을 사용
    - 공유 잠금(shared lock)
    - 전용 잠금(exclusive lock)

### 데이터베이스 설계

- DB 설계 6단계
    - 요구 분석
    - 개념적 DB 설계
    - 논리적 DB 설계
    - 스키마 정제
    - 물리적 DB 설계
    - 응용 및 보안 설계

### 용어

- 개체, 개체 집합
- 속성: 개체 집합이 공통적으로 가지고 있는 성질
- 도메인: 각 속성에 대해 가능한 값의 범위
- 역할: 한 관계 집합에 참여하는 개체 집합이 같은 경우

### 제약 조건

- 키 제약 조건
    - 한 개체나 특정 테이블 행(튜플)의 유일성을 보장하는 조건
    - 후보키: 키 제약 조건을 만족하는 필드들의 집합
        1. 서로 다른 투플은 키 필드 값이 다름
        2. 키 필드의 어떤 부분집합도 유일한 식별자가 될 수 없음(최소성)
    - 슈퍼키: 키를 포함하는 필드들의 집합
    - 기본키: 후보키 중 1개
    - 외래키: 릴레이션에서 다른 릴레이션을 참조할 때, 사용하는 다른 릴레이션의 기본키(필드의 집합)
- 외래키 제약 조건
    - 참조하려는 릴레이션의 primary키가 실제로 존재해야 함(존재하지 않는 외래키 x)
- 참여 제약 조건
    - 한 개체나 특정 테이블 열이 전체적 참여/무조건 존재해야 하는 제약 조건
- 도메인 제약 조건
    - 각 필드의 값들은 도메인에 속한 값들로 제한
- 테이블 제약 조건
    - 한 테이블의 수정될 때마다 검사
- 단언(Assertion)
    - 여러 테이블을 포함하며, 한 테이블이 수정될 때마다 검사
- 무결성 제약 조건
    - 부정확한 정보가 입력되는 것을 방지하는 조건
        - 데이터가 수정 실행될 때, Domain, Primary key, Unique 제약조건들을 위반하는지 검사

### 약 개체

- key를 만들기 위한 충분한 속성이 없는 개체로, 다른 개체의 primary key를 통해 유일하게 구분

### 클래스 계층

- 일반화
    - 여러 개의 공통적인 특성을 가진 더 큰 개체를 만드는 과정
- 세분화
    - 다른 개체들과 구분되는 서브 클래스를 식별하는 과정
- 제약 조건
    - 중첩 제약 조건
        - 두 서브 클래스가 같은 개체를 포함하는게 허용되는지
    - 포괄 제약 조건
        - 모든 서브 클래스가 슈퍼 클래스의 모든 개체를 포함할 수 있는지

### 집단화

- 개체 집합과 관계 집합 사이의 관계를 설정하는 것

### 관계 모델

- 릴레이션 스키마(Relation schema)
    - 테이블의 필드(열, 애트리뷰트)들을 기술
    - 도메인 명시
    - 릴레이션의 차수 = 필드들의 수
- 릴레이션 인스턴스(Relation instance)
    - 레코드(행, 튜플)들의 집합
    - 테이블
    - 카디날리티(cardinality) = 튜플들의 수

### 뷰(View)

- 일종의 테이블로, 실제로 DB에 저장된 것이 아니라 필요에 따라 정의되고 계산됨
- 논리적 데이터 독립성 제공
- 필요한 데이터만 보여줄 수 있어서 보안에도 유용