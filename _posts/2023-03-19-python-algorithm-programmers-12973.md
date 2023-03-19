---
layout: post
title: 짝지어 제거하기
subtitle: 파이썬 알고리즘 
categories: Algorithm
tags: [Algorithm]
---
## 짝지어 제거하기 - 프로그래머스

### 문제
[짝지어 제거하기](https://school.programmers.co.kr/learn/courses/30/lessons/12973)

### 해설
* 전형적인 스택 문제이다.
* 처음에 슬라이싱으로 풀고, replace로 풀었는데 효율성 체크해서 실패해서 스택이라는 힌트를 받고 바로 ~~1분컷~~ 풀었다.
* 이 문제보다는 [크레인인형뽑기](https://school.programmers.co.kr/learn/courses/30/lessons/64061) 문제가 스택으로 접근해야하는게 분명하게 표현되어서 더 좋은 문제인 것 같다.

### 풀이 1
```python
def solution(s):
    stack = []
    for c in s:
        if stack and stack[-1] == c:
            stack.pop()
            continue
        stack.append(c)
    return 1 if len(stack) == 0 else 0
        
```