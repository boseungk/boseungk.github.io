---
layout: post
title: 괄호를 삽입하는 여러가지 방법
subtitle: 파이썬 알고리즘 
categories: Algorithm
tags: [Algorithm]
---
## 괄호를 삽입하는 여러가지 방법 - leetcode 241번

### 문제
[241. Different Ways to Add Parentheses](https://leetcode.com/problems/different-ways-to-add-parentheses/)

### 풀이
```python
class Solution:
    def solution(self, input):  # 2*3-4*5
        def compute(left, right, op):
            result = []
            for l in left:  # 백트래킹 돼서 extend로 합쳐진 결과들에서 for문으로 각각의 계산들을 완료하기 위해서
                for r in right:  # for문을 사용
                    result.append(eval(str(l) + op + str(r)))
            return result

        if input.isdigit():
            return [int(input)]  # 여기에서의 리턴값으로 인해서 각 숫자들에서 별도의 리턴값이 발생 + 각 숫자들만의 연산
        result = []
        for idx, value in enumerate(input):
            if value in "+-*":
                left = self.solution(input[:idx])  # 백트래킹된 값들 -> 연산자로 연산이 된 리턴값 or 개별적인 숫자 리턴값
                right = self.solution(input[idx + 1:])
                result.extend(compute(left, right, value))
        return result

s = "2*3-4*5"
re = Solution().solution(s)
print(re)
```