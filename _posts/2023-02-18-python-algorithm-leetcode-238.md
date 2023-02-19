---
layout: post
title: 자신을 제외한 배열의 곱
subtitle: 파이썬 알고리즘 
categories: Algorithm
tags: [Algorithm]
---
## 자신을 제외한 배열의 곱 - leetcode 238번

### 문제
[238. Product of Array Except Self](https://leetcode.com/problems/product-of-array-except-self/)

입력: [1, 2, 3, 4]

출력: [24, 12, 8, 6]

### 해설
1. 나눗셈을 사용하지 않고 O(n)에 풀이하는것이 포인트다
   1. 나눗셈 대신 곱셈만을 사용해야 한다.
   2. 이때 O(n)안에 풀이하기 위해서는 for문을 내부에 쓰는 대신 ->, <- 이렇게 외부에 2번 써야 한다.
2. 자세히 보면 이전 인덱스의 값들을 누적해서 사용하는 과정이 들어간다.
   1. 누적은 result *= nums[i]를 사용하면 된다.
   2. 이때 이전의 인덱스를 가져와야 한다는 점이 조금 헷갈릴 수 있다. 
      1. 배열에 먼저 append 후 result를 조작하는 방법이 있다.
      2. 아니면 값을 조작하고 if로 다음 인덱스 값에서 대입해주는 방법이 있다.
3. 변수가 많아서 머리속으로만 생각하다가 너무 오래걸렸는데. 이렇게 복잡할때는 차라리 사고과정을 자세하게 적어가면서 접근하는게 훨씬 빠름
### 풀이 1
```python

class Solution:
    def solution(self, nums):
        result = 1
        out = []
        for i in range(len(nums)):
            if i > 0:
                result *= nums[i - 1]
            out.append(result)

        result = 1
        for j in range(len(nums) - 1, -1, -1):
            if j < len(nums) - 1:
                out[j] *= result
            result *= nums[j]
        return out


s = [1, 2, 3, 4]
result = Solution().solution(s)
print(result)

```