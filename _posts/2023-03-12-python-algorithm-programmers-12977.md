---
layout: post
title: 소수 만들기
subtitle: 파이썬 알고리즘 
categories: Algorithm
tags: [Algorithm]
---
## 소수 만들기 - 프로그래머스

### 문제
[소수 만들기](https://school.programmers.co.kr/learn/courses/30/lessons/12977)

### 해설
* 3개의 수에 관한 문제를 풀 때, 삼중 for문 대신 combination이 많이 사용된다.
* 이 문제 풀면서 for else라는 문법을 처음 알게 되었는데, 나름 유용한거 같다.

### for else 문

for 문으로 특정 조건을 체크한 후 for문이 완료되면 해당 조건이 만족한 것이다. 

반면에 for문 도중에 특정 조건 때문에 break로 빠져나온다면 해당 조건을 만족하지 못한 것이다.

이런 상황일때, 사용하면 좋은게 for else문이다.

```python
for i in range(N):
    if i % 2 == 0:
        break # if 조건을 충족해서 break로 빠져나오면 result의 값은 그대로이다.
else:
    result += 1 # if 조건에 맞는 값이 하나도 없어서 for문이 완료되면 result +1이 된다.
```

### 풀이(처음 풀이)
```python
def solution(nums):
    result = 0
    for n in itertools.combinations(nums, 3):
        s, i = sum(n), 0
        for i in range(2, int(s**(1/2))+1):
            if s % i == 0:
                i = -1
                break
        if i == int(s**(1/2)): result += 1
    return result
```

### 다른 풀이
```python
def solution(nums):
    from itertools import combinations as cb
    answer = 0
    for a in cb(nums, 3):
        cand = sum(a)
        for j in range(2, cand):
            if cand%j==0:
                break
        else:
            answer += 1
    return answer
```