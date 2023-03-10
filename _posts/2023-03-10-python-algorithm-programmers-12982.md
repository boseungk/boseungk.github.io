---
layout: post
title: 예산
subtitle: 파이썬 알고리즘 
categories: Algorithm
tags: [Algorithm]
---
## 예산 - 프로그래머스

### 문제

[예산 - Summer/Winter Coding(~2018)](https://school.programmers.co.kr/learn/courses/30/lessons/12982)

### 해설
1. 좋은 그리디 문제이다. 논리적으로 왜 이렇게 되는지 생각해내는게 포인트
2. 해당 시점에서 끝날 때, 조건으로 사용하는 if문은 예외처리로 사용하는게 좋고, 이걸 while문처럼 메인으로 사용하면 카운트 처리하는게 복잡해지니 그런건 지양하자.

### 풀이
```python
def solution(d, budget):
    s, cnt = 0, 0
    d.sort()
    for i in d:
        s += i
        if s > budget: 
            return cnt
        cnt += 1
    return cnt
```