---
layout: post
title: 역순 연결 리스트 2
subtitle: 파이썬 알고리즘 
categories: Algorithm
tags: [Algorithm]
---
## 역순 연결 리스트 2 - leetcode 92번

### 문제
[92. Reverse Linked List II](https://leetcode.com/problems/reverse-linked-list-ii/)

입력: 1->2->3->4->5, m = 2, n = 4

출력: 1->4->3->2->5 

### 해설

1. 인덱스 0부터 역순으로 바뀔 수도 있다.
2. 투 포인트를 기점으로 변화가 생기므로 투 포인터(알고보니 투 포인트를 기점으로 4가지 위치관계를 계속 사용함)
    1. root = start = ListNode(None)
    2. root.next = head (객체 참조라서 start의 값도 바뀜)
    3. start, end 위치 해당 인덱스(m, m+1)로 이동
    4. for _ in range(m-1): start = start.next
    5. end = start.next
3. 인덱스 뒤집기
    ex) 1(s)->2(e)->3->4->5
        1.  1(s)->3->2(e)->4->5로 바뀐다고 생각해보자
        2.  1->3(s->), 2->4(e->) 바꿔주어야 함(얘들부터 처리해야 노드를 안 잃어버림)
        3.  3->2는 start를 유지하면서 상대적 위치관계로 연결관계를 만들어주어야 함
            1.  단방향 연결리스트의 특성상 3->2도 start의 위치관계를 이용해서 정의해주어야 함


### 풀이

```python
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

class Solution:
    def solution(self, head: ListNode, m: int, n: int) -> ListNode:
        if not head or m == n:
            return head

        root = start = ListNode(None)
        root.next = head
        for i in range(m-1):
            start = start.next
        end = start.next
        print(start.val)
        for _ in range(m, n):
            tmp, start.next, end.next = start.next, end.next, end.next.next # start.next의 값은 객체참조 값의 변화에 의해서 변함
            start.next.next = tmp
        return root.next


l1 = ListNode(1)
l1.next = ListNode(2)
l1.next.next = ListNode(3)
l1.next.next.next = ListNode(4)
l1.next.next.next.next = ListNode(5)
m = 2
n = 4
answer = Solution().solution(l1, m, n)
print(answer.val)
print(answer.next.val)
print(answer.next.next.val)
print(answer.next.next.next.val)
print(answer.next.next.next.next.val)

```

