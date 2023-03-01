---
layout: post
title: 과반수 엘리먼트
subtitle: 파이썬 알고리즘 
categories: Algorithm
tags: [Algorithm]
---
## 과반수 엘리먼트 - leetcode 169번

### 문제
[169. Majority Element](https://leetcode.com/problems/majority-element/)

### 해설
1. 가장 작은 단위(0 or 1)로 나누었을때, 합치면서 해결할 수 있을때 -> 분할정복
   1. 재귀함수로 가장 작은 단위까지 나누어준다.(대부분 절반으로 나눠서 다시 호출)
   2. 가장 작은 단위들에 대한 처리 (제일 위에서 if문 처리)
   3. return에서 병합처리(여기서는 Ture or False가 0/1인점을 이용해서 인덱스 처리)
```python
class Solution:
    def solution(self, nums):
        if not nums:
            return None
        if len(nums) == 1:
            return nums[0]
        mid = len(nums) // 2
        a = self.solution(nums[:mid])
        b = self.solution(nums[mid:])
        return [b, a][nums.count(a) > mid]
```

