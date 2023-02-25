---
layout: post
title: 가장 큰 수
subtitle: 파이썬 알고리즘 
categories: Algorithm
tags: [Algorithm]
---
## 리스트 정렬 - leetcode 148번

### 문제
[179. Largest Number](https://leetcode.com/problems/largest-number/)

### 해설
```python
class Solution:
    def solution(self, nums: list[int], target: int):
        left, right = 0, len(nums) - 1
        while left < right:
            mid = left + (right - left) // 2
            # 1-1. 가장 작은 값을 찾으려고 하는데,
            if nums[mid] > nums[right]:
                # 1-2. 중간값보다 오른쪽값이 작으니까
                left = mid + 1
                # 1-3. 왼쪽값들은 버리고 추가로 오른쪽값들 탐색
            else:
                # 2-1. 중간값보다 오른쪽값이 더 크니까, 작은 값을 찾기 위해서
                right = mid
                # 2-2. 오른쪽값 버리고 왼쪽 값들 추가로 탐색
        pivot = left
        # 3. pivot값 자체가 가장 작은 값이라서 배열이 회전한 값을 나타냄

        left, right = 0, len(nums) - 1
        while left < right:
            mid = left + (right - left) // 2
            rotate_mid = (mid + pivot) % len(nums)
            # 4. pivot으로 mid값을 회전시킨 값으로 변환
            if nums[rotate_mid] < target:
                left = mid + 1
            elif nums[rotate_mid] > target:
                right = mid - 1
            # 5. 변환 시킨 값으로 비교 후 범위 조정으로 인덱스 값 보정
            else:
                return rotate_mid
        return -1

s = [4, 5, 6, 7, 0, 1, 2, 3]
target = 1
result = Solution().solution(s, target)
```