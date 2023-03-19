---
layout: post
title: 구명보트
subtitle: 파이썬 알고리즘 
categories: Algorithm
tags: [Algorithm]
---
## 구명보트 - 프로그래머스

### 문제
[구명보트](https://school.programmers.co.kr/learn/courses/30/lessons/42885)

### 해설
* 출제의도가 투포인터인듯 해서 투포인터로 해결했다.
* 기본적으로 구하는 구명보트의 상황에 포커스를 맞추는게 포인트다.
  * 구명보트는 1명 타거나 2명 타는 두가지 케이스를 가지고 있다.
  * 정렬되어 있다면 몸무게가 가장 작은 사람과 가장 큰 사람의 합을 기준으로 생각하는게 합리적이다.
  * 여기서 두 사람의 합이 limit보다 크다면, 몸무게가 가장 큰 사람부터 혼자 구명보트로 태워 보내면 된다.
  * 반면에 두 사람의 합이 limit보다 작은 상황이 나타난다면, 그때 비로소 2명을 구명보트에 태워서 보낼 수 있다.
  * 조건을 잔뜩 달아서 if-else문을 만들다가 꽤 고민했는데, 그거보단 메인-예외를 활용한 if문으로 접근하는게 더 깔끔하다.(무엇보다 시간도 오래걸리고 if 조건을 정확하게 만드는것도 굉장히 까다롭다.)

### 1. 처음 풀이
```python
def solution(people, limit):
    people = sorted(people) 
    num = len(people)
    left, right = 0, num - 1
    cnt = 0 
    while left <= right: 
    # 구명보트 갯수만을 구하기 때문에 테스트 케이스는 통과했지만 논리적으로는 맞지 않다.
        if people[left] + people[right] > limit:
            right -= 1
            cnt += 1
        else:
            left += 1
            right -= 1
            cnt += 1
    return cnt 
```
### 2. 리팩토링한 풀이
```python
def solution(people, limit):
    people = sorted(people) 
    num = len(people)
    left, right = 0, num - 1
    cnt = 0 
    while left < right: 
        # 조건문이 훨씬 단순해졌다.
        if people[left] + people[right] <= limit:
            left += 1
        cnt += 1
        right -= 1
    if left == right: # 혼자 남았을 때, 이렇게 따로 처리해줘야 논리적으로 정확하다.
        cnt += 1
    return cnt 
```