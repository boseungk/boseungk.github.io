---
layout: post
title: 햄버거 만들기
subtitle: 파이썬 알고리즘 
categories: Algorithm
tags: [Algorithm]
---
## 햄버거 만들기 - 프로그래머스

### 문제
[햄버거 만들기](https://school.programmers.co.kr/learn/courses/30/lessons/133502)

### 해설
* 의외로 단순한 문제인데, 푸는데 굉장히 오래걸렸다.
* 그 이유는 계속 인덱스를 기준으로 조건들을 하나하나 따져주려고 해서(기존의 관성대로 접근)
* 특정 조건을 만족할 때, 카운트해야 한다면 그 조건을 분해, 일반화해서 접근하기보단 그 특정 조건만을 if로 처리해서 접근하는게 간단하다.

### 풀이
```python
def solution(ingredient):
    stack = []
    result = 0
    for i in range(len(ingredient)):
        stack.append(ingredient[i])
        if len(stack) >= 4 and stack[-4:] == [1, 2, 3, 1]:
            result += 1
            for _ in range(4):
                stack.pop()
    return result
            
```