---
layout: post
title: JadenCase 문자열 만들기
subtitle: 파이썬 알고리즘 
categories: Algorithm
tags: [Algorithm]
---
## JadenCase 문자열 만들기 - 프로그래머스

### 문제

[JadenCase 문자열 만들기](https://school.programmers.co.kr/learn/courses/30/lessons/12951#)

### 해설
* 처음에 replace로 풀었는데, replace의 경우 중복된 단어도 전부 대문자로 바꿔서 실패..
* 이 문제에서 공백문자가 연속으로 나올 수 있다고 했는데, split(" ")으로 처리해야 한다.
* +=로 조각조각 더해줘서 풀었는데, join함수를 이용하면 더 깔끔하게 풀 수 있다.

### 풀이 1(처음 풀이)
```python
def solution(s):
    result = ""
    s = s.split(" ") # 공백이 연속될때, 이렇게 처리해줘야함
    for i in s:
        i = i[:1].upper() + i[1:].lower()
        result += i
        result += " "
    return result[:-1]
```
### 풀이 2(join 활용)
```python
def solution(s):
    s = s.split(" ")
    for i in range(len(s)):
        s[i] = s[i][:1].upper() + s[i][1:].lower()
    return ' '.join(s)
```