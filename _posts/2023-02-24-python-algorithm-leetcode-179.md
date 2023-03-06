---
layout: post
title: 가장 큰 수
subtitle: 파이썬 알고리즘 
categories: Algorithm
tags: [Algorithm]
---
## 가장 큰 수 - leetcode 179번

### 문제
[179. Largest Number](https://leetcode.com/problems/largest-number/)

### 풀이
```python
class Solution:
    @staticmethod
    def swap(n1: int, n2: int) -> bool:
        return str(n1) + str(n2) < str(n2) + str(n1)

    def solution(self, nums):
        i = 1
        while i < len(nums):
            j = i
            while j > 0 and self.swap(nums[j - 1], nums[j]):
                nums[j - 1], nums[j] = nums[j], nums[j - 1]
                j -= 1
                # 1. 왼쪽에서부터 인덱스 1부터 시작해서 정렬해나감
                # 2. 왼쪽은 다 정렬 되어있기 때문에 대소 비교시 한번만에 끝날수도 있어서 만약 전부 정렬되어있으면 O(n)도 가능
            i += 1
        return str(int(''.join(map(str, nums))))
        # 3. map함수 사용법 참고

s = [3, 30, 34, 5, 9]
result = Solution().solution(s)
print(result)
```