---
layout: post
title: MYSQL 명령어
subtitle: MYSQL 명령어 정리
categories: mysql
tags: [mysql, 명령어]
---

## mysql 명령어

### 데이터베이스 

1. 데이터베이스 생성 <br>
    mysql > `CREATE DATABASE dbname;`

2. 데이터베이스 목록 보기 <br>
    mysql > `SHOW DATABASES;`

3. 데이터베이스 사용하기 <br>
    mysql > `USE dbname;`

4. 데이터베이스 삭제하기 <br>
    mysql > `DROP DATABASE [IF EXISTS] dbname;` 

### 테이블

1. 테이블 생성 <br>
    mysql > `CREATE TABLE tablename();` <br>
    ex) CREATE TABLE mytable(<br>
        id INT UNSIGNED NOT NULL AUTO_INCREMENT, <br>
        name VARCHAR, <br>
        `PRIMARY KEY(id)` <br>
    ); // 소문자는 임의지정(column), 대문자는 명령어

2. 테이블 보기 <br>
    mysql > `SHOW TABLES;`

3. 테이블 목록 보기 <br>
    mysql > `DESC tablename;`

4. 테이블 사용하기 <br>
    mysql > `Use tablename;`

5. 테이블 삭제하기 <br>
    mysql > `DROP TABLE [IF EXISTS] tablename;`

6. 테이블 새로운 컬럼 추가 <br>
    mysql > `ALTER TABLE tablename ADD COLUMN [추가할 컬럼] [추가할 컬럼 데이터타입];` <br>
    ex) ALTER TABLE mytable ADD COLUMN model_type varchar(10) NOT NULL;<br>

7. 테이블 데이터 타입 변경 <br>
    mysql > `ALTER TABLE tablename MODIFY COLUMN [변경할 컬럼명] [변경할 컬럼 데이터타입];`

8. 테이블 이름 / 데이터 타입 변경 <br>
    mysql > `ALTER TABLE tablename CHANGE COLUMN [기존의 컬럼명] [변경할 컬럼명] [변경할 컬럼 데이터타입];`

9. 테이블 컬럼 삭제<br>
    mysql > `ALTER COLUMN tablename DROP COLUMN [기존의 컬럼명] [삭제할 컬럼명];`

### 데이터 

1. 데이터 생성
   1. mysql > `INSERT INTO tablename VALES(123, '값1' ...);` // 전체 컬럼
   2. mysql > `INSERT INTO tablename (column1, column2 ...) VALUES(123, '값1' ...);` // 대응 컬럼
   
2. 데이터 조회
   1. mysql > `SELECT * FROM tablename;` // 전체 데이터
   2. mysql > `SELECT column1, column2 ... FROM tablename;` // 대응 컬럼

3. 데이터 조회 시 표시되는 컬럼명 변경
    mysql > `SELECT beforename1 AS aftername1, beforename2 AS aftername2 From tablename;`

4. 데이터 정렬해서 조회 <br>
    DESC는 내림차순, ASC는 오름차순
   1. mysql > `SELECT * FROM tablename ORDER BY column DESC`// column은 정렬기준
   2. mysql > `SELECT column1, column2 ... FROM tablename ORDER BY column ASC` // column은 정렬기준

5. OR과 AND 조건 연산자로 데이터 조회<br>
    mysql > `SELECT * FROM tablename WHERE column1 < '값' OR column2 > 2 OR colum3 = 3;`

6. LIKE로 부분일치(%, _ 연산자) 데이터 조회<br>
   1. mysql > `SELECT * FROM tablename WHERE column LIKE '%값%';`
   2. mysql > `SELECT * FROM tablename WHERE column LIKE '값__'`// 뒤에 두글자 붙을 경우

7. LIMIT로 데이터 수 제한해서 데이터 조회<br>
   1. mysql > `SELECT * FROM tablename LIMIT 10;` // 처음부터 10개 데이터 조회
   2. mysql > `SELECT * FROM tablename  10 LIMIT 20;` // 10부터 20개 데이터 조회

8. 조건 조합해서 데이터 조회 <br>
    조합순서 SELECT FROM WHERE ORDER BY LIMIT
    mysql > `SELECT column1, column2 FROM tablename WEHERE column1 < 2 AND column2 LIKE %값% ORDER BY column1 DESC LIMIT 10;`

9. 데이터 수정<br>
    mysql > `UPDATE tablename SET 수정하고싶은 columnname1 = '수정하고 싶은 값1', ... WHERE column = '값';`<br>
    ex) 
    ----+------+-----------+------------+ | id | name | model_num | model_type |

    ----+------+-----------+------------+ | 3 | i7 | 7700 | Kaby Lake |

    ----+------+-----------+------------+ mysql> UPDATE mytable SET name = 'i5', model_num = '5500' WHERE id = 3; mysql> SELECT * FROM mytable;

    ----+------+-----------+------------+ | id | name | model_num | model_type |

    ----+------+-----------+------------+ | 3 | i5 | 5500 | Kaby Lake |

    ----+------+-----------+------------+

10. 데이터 삭제 <br>
    1. mysql > `DELETE FROM tablename WHERE 특정 column = '값';`
    2. mysql > `DELETE FROM tablename;`
