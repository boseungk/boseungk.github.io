---
layout: post
title: 최댓값과 최솟값
subtitle: 파이썬 알고리즘 
categories: Algorithm
tags: [Algorithm]
---
## 최댓값과 최솟값 - 프로그래머스

### 문제

[최댓값과 최솟값](https://school.programmers.co.kr/learn/courses/30/lessons/12939)

### 해설 
* 쉬운 문제지만 파이썬 기본 함수들을 연습하기에 좋은 문제
* split, map, max, min를 연습해볼 수 있는 예제 문제

### 풀이
```python
def solution(s):
    tmp = list(map(int, s.split()))
    return str(min(tmp)) + " " + str(max(tmp))
```