---
layout: post
title: 단어공부 백준 1157번
subtitle: 파이썬 알고리즘 
categories: Algorithm
tags: [Algorithm]
---
## 단어공부 - 백준 1157번
### 문제

[단어공부 - 백준 1157번](https://www.acmicpc.net/problem/1157)

### 해설

1. 입출력 -> 대문자로 → 카운팅 리스트 필요
2. 카운팅 리스트
    1. 목차는 set으로 구현, 대응 값들은 count로 구현
    2. set, list에 자동대응
3. 문자별 최다 카운팅→ 인덱스 함수로 인덱스 찾기 -> 대문자로 출력, 2개 이상이면 "?" 출력
4. 여기서 count 리스트를 보관 안하고 최댓값 시점일때 끝내는 방식도 있음

### 처음 풀이

```python
w = input().upper()
upper_words = list(set(w))

cnt_list = []
for x in upper_words :
    cnt_list.append(w.count(x)) 

if cnt_list.count(max(cnt_list)) > 1 :  
    print('?')
else :
    index = cnt_list.index(max(cnt_list))  
    print(upper_words[index])
```

### 다른 풀이
```python
s = input().upper()
    a = 0
    for i in set(s):
        c = s.count(i)
        if a == c: b = '?'
        if a < c:
            a = c
            b = i
    print(b)
```