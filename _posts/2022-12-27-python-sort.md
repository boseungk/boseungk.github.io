---
layout: post
title: [Python] lambda, sort 함수
subtitle: lambda, sort 함수에 대해 이해해보기
categories: Python
tags: [Python]
---
## lambda 표현식
### lambda x: (x)
lambda는 함수의 선언이나 식별자 없이 하나의 식으로 함수를 표현하는 방법이다
다음의 함수는 
```python
def func(x, y):
    return x + y
```
아래와 같이 람다 표현식으로 표현할 수 있다.
```python
lambda x, y: x + y
```

### lambda 예시
```python 
lambda x: x + 1 # 변수 1개
lambda x: (x + 1)(1) # 괄호로 변수 값 주기
lambda x, y: x + y # 변수 2개
```

## sort 함수

### sort()
sort 함수를 통해서 리스트를 정렬 할 수 있다. 
```python 
a = [2, 3, 5, 4, 1]
a.sort()
print(a) // a = [1, 2, 3, 4, 5]
```
### sort(key = func)
sort 함수의 key 인자를 사용해서 정렬 기준을 제공해줄 수 있다.
```python
a = [(0, 1), (1, 5), (2, 3), (1, 2)]
a.sort(key=lambda x: x[0] # 튜플 a를 정렬하는데 (x, y) 중 x 기준 정렬
print(a)
# [(0, 1), (1, 5), (1, 2), (2, 3)] 출력
```
이때 key 인자에 두번째 값을 통해서 같은 우선 순위인 값들의 두번째 기준을 제공해줄 수 있다.
```python
a = [(0, 1), (1, 5), (2, 3), (1, 2)]
a.sort(key=lambda x: (x[0], x[1]))
print(a)
#[(0, 1), (1, 2), (1, 5), (2, 3)]
a.sort(key=lambda x: (x[0], -x[1]))# -는 내림차순
print(a)
#[(0, 1), (1, 5), (1, 2), (2, 3)]
```
