---
layout: post
title: 비밀지도
subtitle: 파이썬 알고리즘 
categories: Algorithm
tags: [Algorithm]
---
## 비밀지도 - 프로그래머스

### 문제
[비밀지도](https://school.programmers.co.kr/learn/courses/30/lessons/17681)

### 해설
* 처음에 풀었을 때는 이중 for문이랑 if문으로 문자열을 일일히 분리했었다.
* 다른 좋은 풀이에서는 비트 연산자를 이용해서 해결했다.
* 2개의 for문을 사용하는 대신 for in zip을 사용하면 더 깔끔하게 활용할 수 있다.
* 비트 연산자, zfill, replace, zip 함수에 대해서 배울 수 있는 좋은 문제이다.

### 풀이 1
```python
def solution(n, arr1, arr2):
    result = []
    for i in range(n):
        result.append(bin(arr1[i]|arr2[i])[2:]
                      .zfill(n)
                      .replace('1', "#")
                      .replace('0', " "))
    return result
```
### 풀이 2
```python
def solution(n, arr1, arr2):
    answer = []
    for i,j in zip(arr1,arr2):
        a12 = str(bin(i|j)[2:])
        .rjust(n,'0')
        .replace('1','#')
        .replace('0',' ')
        answer.append(a12)
    return answer
```