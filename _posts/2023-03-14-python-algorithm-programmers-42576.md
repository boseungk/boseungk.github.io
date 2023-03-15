---
layout: post
title: 완주하지 못한 선수
subtitle: 파이썬 알고리즘 
categories: Algorithm
tags: [Algorithm]
---
## 완주하지 못한 선수 - 프로그래머스

### 문제
[완주하지 못한 선수](https://school.programmers.co.kr/learn/courses/30/lessons/42576/)

### 해설
* 문제 자체는 간단하지만 효율성을 고려해야 하는게 포인트인 문제다.
* 처음에 딕셔너리를 이용해야 한다는건 알아차렸지만 머리 속으로 구상하느라 Counter를 이용한 풀이로 넘어가는데 오랜 시간이 걸렸다.
* 문제에서 요구하는 개념을 마인드맵으로 그리면서 시각화하면서, 적절하지 않은 개념은 소거하며 접근해야 빠르게 해결할 수 있다.

### 풀이 1

```python
import collections
def solution(participant, completion):
    p_num = collections.Counter(participant)
    c_num = collections.Counter(completion)
    for p in p_num:
        if p_num[p] - c_num[p] > 0:
            return p
```