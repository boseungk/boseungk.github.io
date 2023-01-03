---
layout: post
title: 빗물 트래핑(Trapping Rain Water)
subtitle: LeetCode 42번 
categories: Algorithm
tags: [Algorithm]
---
## 빗물 트래핑 

### 문제

[42. LeetCode Trapping Rain Water](https://leetcode.com/problems/trapping-rain-water/)

높이를 입력받아 비가 온 후 얼마나 많은 물이 쌓일 수 있는지 계산하는 문제이다.

![rainwatertrap](https://user-images.githubusercontent.com/95980754/210230576-812f764b-22b3-44e4-bde8-829e30a3722c.png)

 

입력값의 예시는 

> [0, 1, 0, 2, 1, 0, 3, 2, 1, 2, 1]

이다

### 해설 1

먼저 해결의 실마리를 예시를 하나하나 들어보면서 찾아야 한다. 어떤 조건일때 빗물이 고이는지 생각해보자. 

먼저 입력값이 [1, 0, 1]이라고 생각해보자
그러면 인덱스 1에서 빗물이 고이게 된다.

이제 인덱스 0과 1을 고정시킨 후 값을 변화시키면서 어떤 영향을 미치는지 관찰한다. (변수가 많으면 변화를 관찰하기 어렵기 때문에 다른 변수들을 고정시키고 관찰하는 것이 합리적이다.)

입력값이 [1, 0, 2], [1, 0, 3]으로 변화시켜도 빗물의 양은 1로 변하지 않는다. 

그렇다면 이번에는 인덱스 0을 변화시키고 나머지 변수는 고정시킨 후 관찰한다. 

[2, 0, 2]이 되면 빗물의 양이 2로 변하게 된다. 

그렇다면 마지막으로 인덱스 1을 변화시키고 나머지 값들을 고정시켜본다. 

[1, 1, 2]가 되면 빗물의 양이 0으로 바뀌게 된다. 

즉 ``양쪽 값의 최솟값``과 ``중앙값``이 빗물의 양에 영향을 미친다는 것을 알 수 있다. 

따라서 입력값의 최댓값을 고정시키면 양쪽 값의 최솟값과 중앙값으로 빗물의 양이 결정된다. 따라서 또한 최댓값의 양쪽을 나누어서 따로따로 관찰한 후 두 결과를 합치는 것을 통해 해답을 얻을 수 있다. 

양쪽으로 나눈 중앙의 각 변수를 ``포인터``라고 부르기로 하자 또 빗물을 결정하는 양쪽의 최솟값은 중앙값보단 항상 크기 때문에 left_max, right_max라고 하자


```python
def trap(self, height: List[int]) -> int:
    if not height:
        return 0
    volume = 0 # 빗물의 양
    left, right = 0, len(height) - 1 # 투포인터
    left_max, right_max = height[left], height[right] # 포인터가 가리키는 값
    while left < right: # 포인터가 같아지면 과정이 끝난다.
        left_max, right_max = max(height[left], left_max), max(heigt[right], right_max)
        if left_max <= right_max:
            volume += left_max - height[left]
            left += 1
        else:
            volume += right_max - height[right]
            right -= 1
```
### 해설 2

위에서 `투포인터`를 이용해서 풀었다면 `스택`을 이용해서 풀어 볼 수 있다.

물 웅덩이에 영향을 미치는건 양쪽 중 최솟값과 중앙값이다. 이때 중앙값은 포인터라고 생각하자. 

그리고 `스택`에 `인덱스`를 담아서 이전의 높이를 표현할 수 있다. 

현재 높이가 이전의 높이보다 높을때, 물웅덩이가 카운팅 된다.

```python
def trap(self, height: List[int]) -> int:
    stack = []
    volume = 0

    for i in range(len(height)): # i는 포인터
        while stack and height[i] > height[stack[-1]]: # 포인터의 높이가 이전의 높이보다 높은 상태
            top = stack.pop() # stack으로 이전의 위치 불러오기
            if not len(stack): 
                break 
            distance = i - stack[-1] - 1
            waters = min(height[i], height[stack[-1]]) - height[top] # 양쪽 중 최솟값 정한 후 중앙값 빼주기
            volume += distance * waters
        stack.append(i) 
    return volume
```

