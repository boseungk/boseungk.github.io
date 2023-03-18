---
layout: post
title: 대충 만든 자판
subtitle: 파이썬 알고리즘 
categories: Algorithm
tags: [Algorithm]
---
## 대충 만든 자판 - 프로그래머스

### 문제
[대충 만든 자판](https://school.programmers.co.kr/learn/courses/30/lessons/160586)

### 해설
* 처음에 삼중 for문으로 풀었는데, 다른 사람의 풀이를 참고해서 dictionary를 활용해서 다시 풀었다. -> 최단거리를 찾을 때나 list의 시간복잡도를 줄일때 dictionary를 사용하면 좋다.
* if문을 잘못 처리해서 계속 테스트 케이스에서 오류가 발생했다.
* if문을 사용할 때, 예외 케이스를 if문으로 쓰고 메인 논리는 if문을 사용하는 것을 피해야 한다.(왜냐하면 메인 논리에 if를 사용하면 이분법적인 상황이 아닌데 else를 사용하게 될 수 있다.)

### 1. 잘못 푼 풀이
```python
def solution(keymap, targets):    
    map = dict()
    for chars in keymap:
        for idx, char in enumerate(chars):
            if char not in map:
                map[char] = idx+1
            else:
                map[char] = min(idx+1, map[char])
    result = []
    for chars in targets:
        s = 0
        for char in chars:
            if char in map:
                s += map[char]
            else: # 이분법적인 상황이 아닌데 잘못 사용
                result.append(-1) 
                break
        result.append(s) if s != 0 else None
    return result     
```

### 2. 정답
```python
def solution(keymap, targets):    
    map = dict()
    for chars in keymap:
        for idx, char in enumerate(chars):
            if char not in map:
                map[char] = idx+1
            else:
                map[char] = min(idx+1, map[char])
    result = []
    for chars in targets:
        s = 0
        for char in chars:
            if char not in map: # 예외처리로 사용하는게 맞음
                s = -1
                break
            s += map[char]
        result.append(s) 
    return result
        
```