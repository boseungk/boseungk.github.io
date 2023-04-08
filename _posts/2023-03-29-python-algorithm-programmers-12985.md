---
layout: post
title: 예상 대진표
subtitle: 파이썬 알고리즘 
categories: Algorithm
tags: [Algorithm]
---
## 예상 대진표 - 프로그래머스

### 문제
[예상 대진표](https://school.programmers.co.kr/learn/courses/30/lessons/12985)

### 해설

꽤 고민을 오래한 문제인데, 그러면서 문제 접근 방식에 대한 고민을 하게 되었다.

처음 이 문제를 접근했을 때, 문제의 사례를 일반화하는 방식으로 접근했다. 

하지만 이렇게 바로 접근하는 방식은 문제의 구조를 제대로 파악하지 못하고 어설프게 일반화한다는 생각이 들었다.

그래서 문제를 그려가면서 시각화하면서 문제의 구조를 파악해보려고 했다. 그러자 문제의 핵심을 이해하게 되었다. 
  
이 문제의 핵심은 두 수를 하나의 그룹으로 묶어서 표현하는 것이다.
  
이 과정을 통해서 중요한 점을 알게 되었다.
  * 문제의 전체 구조를 이해하고 일반화해서 코드로 표현하는 것
  * 문제의 디테일을 코드로 잘 구현하는 것

위의 두 과정을 필요로 한다는 점이다.

### 풀이
```python
def solution(n,a,b):
    result = 0
    while a != b:
        a, b = (a + 1) // 2, (b + 1) // 2
        result += 1
    return result
```